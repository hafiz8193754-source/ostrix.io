import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { markNotificationsRead } from "@/lib/notifications";

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  await markNotificationsRead(db, user.id);
  return NextResponse.json({ ok: true });
}
