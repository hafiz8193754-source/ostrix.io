import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { scheduleUpdateSchema } from "@/lib/schemas";
import { getDoctorByUserId, getDoctorScheduleAndExceptions, saveDoctorSchedule } from "@/lib/clinical";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const doctor = await getDoctorByUserId(user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });

  const result = await getDoctorScheduleAndExceptions(doctor.id);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const doctor = await getDoctorByUserId(user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });

  const body = await request.json();
  const parsed = scheduleUpdateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const schedule = await saveDoctorSchedule(doctor.id, parsed.data.schedule);
  return NextResponse.json({ schedule });
}
