import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { deleteAllChatHistory } from "@/lib/profiles";

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const result = await deleteAllChatHistory(db, user.id);
  return NextResponse.json({ ok: true, ...result });
}
