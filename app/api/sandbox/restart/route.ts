import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { runInSandbox } from "@/lib/sandbox";
import { sandboxRestartSchema } from "@/lib/schemas";

export const maxDuration = 60;

// Restarts the E2B sandbox for a given set of files — called from the
// Console tab's "Restart sandbox" button.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = sandboxRestartSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "No files provided." }, { status: 400 });

  try {
    const result = await runInSandbox(parsed.data.files);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Sandbox restart failed." }, { status: 502 });
  }
}
