import { NextResponse } from "next/server";
import { getUserFromRequest, getSessionOwned, listMessages, appendMessage } from "@/lib/serverAuth";
import { messageAppendSchema } from "@/lib/schemas";
import type { ChatMessage } from "@/types";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: Request, { params }: RouteParams) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const owned = await getSessionOwned(user.id, params.id);
  if (!owned) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  const messages = await listMessages(params.id);
  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const owned = await getSessionOwned(user.id, params.id);
  if (!owned) return NextResponse.json({ error: "Session not found." }, { status: 404 });

  const body = await request.json();
  const parsed = messageAppendSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid message." }, { status: 400 });

  await appendMessage(params.id, parsed.data.role, parsed.data.content as unknown as ChatMessage);
  return NextResponse.json({ ok: true });
}
