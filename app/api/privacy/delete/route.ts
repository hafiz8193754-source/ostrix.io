import { NextResponse } from "next/server";
import { getUserFromRequest, wipeUserData } from "@/lib/serverAuth";
import { deleteDataSchema } from "@/lib/schemas";

// Defense in depth: the client already gates this behind a "type DELETE to
// confirm" input, but the server independently requires the same literal.
export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const body = await request.json();
  const parsed = deleteDataSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Type "DELETE" to confirm.' }, { status: 400 });

  await wipeUserData(db, user.id);
  return NextResponse.json({ ok: true });
}
