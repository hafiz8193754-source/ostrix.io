import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { deploySchema } from "@/lib/schemas";
import type { DeployResult } from "@/types";

export const maxDuration = 60;

interface VercelDeployment {
  alias?: string[];
  url: string;
}

// Deploys a generated multi-file project:
// 1. (optional) creates a GitHub repo and commits every file — user owns the code
// 2. deploys the same files to Vercel via the Deployments API — user gets a live URL
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = deploySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Nothing to deploy." }, { status: 400 });
  const { name, files } = parsed.data;

  const slug = `${name.toLowerCase().replace(/[^a-z0-9-]/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const result: DeployResult = { repo: null, url: null };

  // --- GitHub (optional: set GITHUB_TOKEN with `repo` scope) ---
  if (process.env.GITHUB_TOKEN) {
    try {
      const gh = (path: string, opts: RequestInit = {}) =>
        fetch(`https://api.github.com${path}`, {
          ...opts,
          headers: {
            authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            accept: "application/vnd.github+json",
            "content-type": "application/json",
            ...opts.headers,
          },
        });
      const repoRes = await gh("/user/repos", {
        method: "POST",
        body: JSON.stringify({ name: slug, description: `Built with Ostrix`, auto_init: false }),
      });
      if (repoRes.ok) {
        const repo = await repoRes.json();
        for (const f of files) {
          await gh(`/repos/${repo.full_name}/contents/${f.path}`, {
            method: "PUT",
            body: JSON.stringify({
              message: `Add ${f.path}`,
              content: Buffer.from(f.content, "utf8").toString("base64"),
            }),
          });
        }
        result.repo = repo.html_url;
      }
    } catch (e) {
      // GitHub failure shouldn't block the live deploy
    }
  }

  // --- Vercel deployment (required: VERCEL_TOKEN) ---
  if (!process.env.VERCEL_TOKEN)
    return NextResponse.json({ error: "Deployment is not configured yet (missing VERCEL_TOKEN).", repo: result.repo }, { status: 501 });

  try {
    const res = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: slug,
        target: "production",
        files: files.map((f) => ({ file: f.path, data: f.content })),
        projectSettings: { framework: null },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const dep: VercelDeployment = await res.json();
    result.url = `https://${dep.alias?.[0] || dep.url}`;
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "Live deploy failed — check your VERCEL_TOKEN.", repo: result.repo }, { status: 502 });
  }
}
