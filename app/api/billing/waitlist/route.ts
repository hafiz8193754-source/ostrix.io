import { NextResponse } from "next/server";
import { getUserFromRequest, insertWaitlistEmail } from "@/lib/serverAuth";
import { waitlistSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const body = await request.json();
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid email." }, { status: 400 });

  await insertWaitlistEmail(db, user.id, parsed.data.email);
  return NextResponse.json({ ok: true });
}
