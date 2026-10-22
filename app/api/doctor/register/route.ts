import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { doctorRegisterSchema } from "@/lib/schemas";
import { createNotification } from "@/lib/notifications";
import { getDoctorByUserId, isPmdcNumberTaken, logDoctorVerification, registerDoctor } from "@/lib/clinical";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const existing = await getDoctorByUserId(user.id);
  if (existing) return NextResponse.json({ error: "You already have a doctor profile." }, { status: 400 });

  const rawBody = await request.json();
  // pmdc_verified must never be settable by this route, no matter what the
  // client sends — strip it (and every other verification field) before it
  // ever reaches zod or the DB, on top of those fields simply not being part
  // of doctorRegisterSchema in the first place.
  if (rawBody && typeof rawBody === "object") {
    delete (rawBody as Record<string, unknown>).pmdc_verified;
    delete (rawBody as Record<string, unknown>).registration_status;
    delete (rawBody as Record<string, unknown>).verified_at;
    delete (rawBody as Record<string, unknown>).verified_by;
    delete (rawBody as Record<string, unknown>).is_active;
  }

  const parsed = doctorRegisterSchema.safeParse(rawBody);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  if (await isPmdcNumberTaken(parsed.data.pmdc_number)) {
    return NextResponse.json(
      { error: "This PMDC number is already registered. Contact support if this is an error." },
      { status: 409 }
    );
  }

  const doctor = await registerDoctor(user.id, parsed.data);
  if (!doctor) return NextResponse.json({ error: "Could not submit your registration. Please try again." }, { status: 500 });

  await logDoctorVerification(doctor.id, null, "pending", null);
  await createNotification(
    user.id,
    "registration_submitted",
    "Registration submitted",
    "Our team will verify your PMDC registration within 24-48 hours. You'll be notified once verified. Until then you can complete your profile but cannot accept patients or sign prescriptions.",
    "/doctor/dashboard"
  );

  return NextResponse.json({
    doctor_id: doctor.id,
    registration_status: doctor.registration_status,
    message:
      "Registration submitted. Our team will verify your PMDC registration within 24-48 hours. You'll be notified once verified. Until then you can complete your profile but cannot accept patients or sign prescriptions.",
  });
}
