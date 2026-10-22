import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getDoctorByUserId, getDashboardData } from "@/lib/clinical";
import { twilioConfigured } from "@/lib/twilio";

// Not in the literal spec, but the dashboard page needs a single call that
// (a) tells it whether the logged-in user is a registered doctor at all, and
// (b) returns everything the dashboard renders — instead of four round trips.
export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const doctor = await getDoctorByUserId(db, user.id);
  if (!doctor) return NextResponse.json({ doctor: null });

  const { todaysAppointments, upcomingAppointments, pendingPrescriptions, recentConsultations } = await getDashboardData(db, doctor.id);
  const { data: signedPrescriptions } = await db
    .from("prescriptions")
    .select("id, status, version, verify_code, doctor_signed_at, final_prescription")
    .eq("doctor_id", doctor.id)
    .eq("status", "approved")
    .order("doctor_signed_at", { ascending: false })
    .limit(10);
  return NextResponse.json({ doctor, todaysAppointments, upcomingAppointments, pendingPrescriptions, recentConsultations, signedPrescriptions: signedPrescriptions || [], phoneCallAvailable: twilioConfigured() });
}
