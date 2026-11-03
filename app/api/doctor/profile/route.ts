import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/serverAuth";
import { getDoctorByUserId } from "@/lib/clinical";
import { doctorProfileUpdateSchema } from "@/lib/schemas";
import { SPECIALIZATIONS } from "@/components/doctor/registration/types";
import { PUBLIC_DOCTOR_COLUMNS } from "@/lib/publicDoctors";

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const doctor = await getDoctorByUserId(auth.db, auth.user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });
  const { data } = await auth.db.from("doctors").select(`${PUBLIC_DOCTOR_COLUMNS}, registration_status`).eq("id", doctor.id).single();
  return NextResponse.json({ doctor: data });
}

export async function PATCH(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const doctor = await getDoctorByUserId(auth.db, auth.user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });

  const parsed = doctorProfileUpdateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const input = parsed.data;
  if (input.specialization && !SPECIALIZATIONS.some(([id]) => id === input.specialization))
    return NextResponse.json({ error: "Unknown specialty." }, { status: 400 });

  // Whitelisted fields only — never PMDC / verification / status columns.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.specialization !== undefined) patch.specialization = input.specialization;
  if (input.consultation_fee_pkr !== undefined) patch.consultation_fee_pkr = input.consultation_fee_pkr;
  if (input.bio !== undefined) patch.bio = input.bio || null;
  if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url || null;
  if (input.accepts_online !== undefined) patch.accepts_online = input.accepts_online;
  if (input.accepts_walk_in !== undefined) patch.accepts_walk_in = input.accepts_walk_in;

  const { data, error } = await auth.db
    .from("doctors")
    .update(patch)
    .eq("id", doctor.id)
    .select(`${PUBLIC_DOCTOR_COLUMNS}, registration_status`)
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  return NextResponse.json({ doctor: data });
}
