import { NextResponse } from "next/server";
import { getUserFromRequest, getSessionOwned, listMessages, appendMessage } from "@/lib/serverAuth";
import { messageAppendSchema } from "@/lib/schemas";
import type { ChatMessage } from "@/types";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: Request, { params }: RouteParams) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const owned = await getSessionOwned(db, user.id, params.id);
  if (!owned) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  const messages = await listMessages(db, params.id);
  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const owned = await getSessionOwned(db, user.id, params.id);
  if (!owned) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  const body = await request.json();
  const parsed = messageAppendSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid message." }, { status: 400 });

  await appendMessage(db, params.id, parsed.data.role, parsed.data.content as unknown as ChatMessage);
  return NextResponse.json({ ok: true });
}
