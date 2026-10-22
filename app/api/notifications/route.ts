import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { listNotifications, countUnreadNotifications } from "@/lib/notifications";

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const [notifications, unreadCount] = await Promise.all([listNotifications(db, user.id), countUnreadNotifications(db, user.id)]);
  return NextResponse.json({ notifications, unreadCount });
}
