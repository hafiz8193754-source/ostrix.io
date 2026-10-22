// Spins up a real sandboxed environment via E2B, writes the generated project
// files into it, serves them, and runs a real syntax check on every .js file
// so `errors` reflects something Claude can actually fix — not a placeholder.
// Each sandbox lives for timeoutMs then auto-destructs; no manual cleanup.
import { Sandbox } from "e2b";

import { autoFix } from "@/lib/autoFix";
import type { SiteFile } from "@/types";

export interface SandboxResult {
  previewUrl: string | null;
  errors: string[];
  logs: string[];
  success: boolean;
}

const PROJECT_DIR = "/home/user/project";
const PORT = 3001;

// Our generated projects never include a package.json (the builder system
// prompt only ever emits static HTML/CSS/JS + optional Vercel-style api/*.js
// files) — this branch exists for forward-compatibility, not because it's
// exercised today.
async function startServer(sandbox: Sandbox, hasPackageJson: boolean, logs: string[]) {
  if (hasPackageJson) {
    const install = await sandbox.commands.run(`cd ${PROJECT_DIR} && npm install --silent`, { timeoutMs: 60_000 });
    if (install.stderr) logs.push(install.stderr);
    await sandbox.commands.run(`cd ${PROJECT_DIR} && npm run dev -- --port ${PORT} &`, { background: true });
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    await sandbox.commands.run(`cd ${PROJECT_DIR} && python3 -m http.server ${PORT} &`, { background: true });
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// Real validation, not decorative: `node --check` parses each script without
// executing it, catching the syntax errors Claude occasionally produces
// (unbalanced braces, stray tokens) so the auto-fix loop has something real
// to act on instead of an array that's always empty.
async function checkJsSyntax(sandbox: Sandbox, files: SiteFile[]): Promise<string[]> {
  const errors: string[] = [];
  const jsFiles = files.filter((f) => f.path.endsWith(".js"));
  for (const file of jsFiles) {
    const result = await sandbox.commands.run(`node --check ${PROJECT_DIR}/${file.path}`);
    if (result.exitCode !== 0) {
      errors.push(`${file.path}: ${(result.stderr || "syntax error").trim()}`);
    }
  }
  return errors;
}

export async function runInSandbox(files: SiteFile[]): Promise<SandboxResult> {
  const errors: string[] = [];
  const logs: string[] = [];

  if (!process.env.E2B_API_KEY) {
    return { previewUrl: null, errors: [], logs: ["E2B_API_KEY not set — skipping sandbox."], success: false };
  }

  try {
    const sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY, timeoutMs: 120_000 });

    for (const file of files) {
      const dir = file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : null;
      if (dir) await sandbox.commands.run(`mkdir -p ${PROJECT_DIR}/${dir}`);
      await sandbox.files.write(`${PROJECT_DIR}/${file.path}`, file.content);
    }
    logs.push(`Wrote ${files.length} file${files.length === 1 ? "" : "s"} into the sandbox.`);

    errors.push(...(await checkJsSyntax(sandbox, files)));

    const hasPackageJson = files.some((f) => f.path === "package.json");
    await startServer(sandbox, hasPackageJson, logs);

    const host = await sandbox.getHost(PORT);
    const previewUrl = `https://${host}`;
    logs.push(`Serving at ${previewUrl}`);

    return { previewUrl, errors, logs, success: true };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Sandbox execution failed");
    return { previewUrl: null, errors, logs, success: false };
  }
}

export interface SandboxPassResult {
  files: SiteFile[];
  sandboxPreviewUrl: string | null;
  sandboxErrors: string[];
  sandboxLogs: string[];
}

// Shared by both /api/builder and /api/builder/screenshot: run the sandbox,
// and if it surfaces errors, ask Claude to fix them once and re-run. Entirely
// optional — skipped (and never throws) when E2B_API_KEY isn't set, so both
// callers can fall back to the static iframe preview without any special-casing.
export async function runSandboxPass(files: SiteFile[]): Promise<SandboxPassResult> {
  if (!process.env.E2B_API_KEY) {
    return { files, sandboxPreviewUrl: null, sandboxErrors: [], sandboxLogs: [] };
  }

  try {
    let finalFiles = files;
    let result = await runInSandbox(finalFiles);

    if (!result.success || result.errors.length > 0) {
      finalFiles = await autoFix(finalFiles, result.errors);
      result = await runInSandbox(finalFiles);
    }

    return { files: finalFiles, sandboxPreviewUrl: result.previewUrl, sandboxErrors: result.errors, sandboxLogs: result.logs };
  } catch {
    // E2B failure is non-blocking — fall back to the static iframe preview.
    return { files, sandboxPreviewUrl: null, sandboxErrors: [], sandboxLogs: [] };
  }
}
