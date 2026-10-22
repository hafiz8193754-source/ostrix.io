import { NextResponse } from "next/server";
import { getUserFromRequest, listSessions, createSession } from "@/lib/serverAuth";
import { sessionCreateSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const sessions = await listSessions(db, user.id);
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const body = await request.json();
  const parsed = sessionCreateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const { agent, title } = parsed.data;
  const session = await createSession(db, user.id, agent, title || "New chat");
  if (!session) return NextResponse.json({ error: "Could not create session." }, { status: 500 });
  return NextResponse.json({ session });
}
