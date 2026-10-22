import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { notifyMeSchema } from "@/lib/schemas";
import { createDoctorNotifyRequest } from "@/lib/clinical";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = notifyMeSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  await createDoctorNotifyRequest(user.id, parsed.data.doctor_id);
  return NextResponse.json({ ok: true });
}
