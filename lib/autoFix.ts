// Takes errors from the sandbox, sends them to Claude with the current files,
// and returns corrected files. Reuses the shared ===FILE:=== parser/merger
// from lib/siteFiles.ts instead of duplicating that logic.
import { claude } from "@/lib/anthropic";
import { parseFiles, mergeFiles } from "@/lib/siteFiles";
import type { SiteFile } from "@/types";

const FIX_SYSTEM = `You are a senior developer debugging a web project.
You will be given the current project files and a list of errors.
Fix ONLY what is broken. Return ONLY the corrected files in this format:
===FILE: path===
(corrected content)
===END===
Do not return files that do not need changes.
Do not explain anything. Just return the corrected files.`;

export async function autoFix(files: SiteFile[], errors: string[], maxAttempts = 3): Promise<SiteFile[]> {
  let current = [...files];
  let remainingErrors = errors;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (remainingErrors.length === 0) break;

    const filesContext = current.map((f) => `===FILE: ${f.path}===\n${f.content}`).join("\n\n");
    const errorContext = remainingErrors.join("\n");

    const raw = await claude({
      system: FIX_SYSTEM,
      content: `ERRORS:\n${errorContext}\n\nCURRENT FILES:\n${filesContext}`,
      maxTokens: 8000,
    });

    const fixes = parseFiles(raw);
    if (fixes.length === 0) break;

    current = mergeFiles(current, fixes);
    // Optimistically assume fixed — the caller re-runs the sandbox to confirm;
    // if new errors surface there, that's a fresh autoFix call, not this loop.
    remainingErrors = [];
  }

  return current;
}
