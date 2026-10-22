import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getDoctorByUserId, getDashboardData } from "@/lib/clinical";

// Not in the literal spec, but the dashboard page needs a single call that
// (a) tells it whether the logged-in user is a registered doctor at all, and
// (b) returns everything the dashboard renders — instead of four round trips.
export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const doctor = await getDoctorByUserId(db, user.id);
  if (!doctor) return NextResponse.json({ doctor: null });

  const { todaysAppointments, pendingPrescriptions, recentConsultations } = await getDashboardData(db, doctor.id);
  return NextResponse.json({ doctor, todaysAppointments, pendingPrescriptions, recentConsultations });
}
