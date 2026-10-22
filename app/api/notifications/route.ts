import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { listNotifications, countUnreadNotifications } from "@/lib/notifications";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const [notifications, unreadCount] = await Promise.all([listNotifications(user.id), countUnreadNotifications(user.id)]);
  return NextResponse.json({ notifications, unreadCount });
}
