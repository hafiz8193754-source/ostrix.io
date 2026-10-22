import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { markNotificationsRead } from "@/lib/notifications";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  await markNotificationsRead(user.id, [params.id]);
  return NextResponse.json({ ok: true });
}
