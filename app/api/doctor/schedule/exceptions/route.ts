import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { availabilityExceptionSchema } from "@/lib/schemas";
import { getDoctorByUserId, upsertAvailabilityException, deleteAvailabilityException } from "@/lib/clinical";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const doctor = await getDoctorByUserId(user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });

  const body = await request.json();
  const parsed = availabilityExceptionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const exception = await upsertAvailabilityException(doctor.id, parsed.data);
  if (!exception) return NextResponse.json({ error: "Could not save that exception." }, { status: 500 });
  return NextResponse.json({ exception });
}

export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const doctor = await getDoctorByUserId(user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date." }, { status: 400 });

  await deleteAvailabilityException(doctor.id, date);
  return NextResponse.json({ ok: true });
}
