import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getOrCreateConsultation } from "@/lib/clinical";
import { authorizeVisit, displayDoctorName, iceServers, visitRoomKey } from "@/lib/visit";
import { twilioConfigured } from "@/lib/twilio";

// Room bootstrap: who am I in this visit, the signaling room key, ICE servers.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;
  const access = await authorizeVisit(db, user, params.id);
  if (!access) return NextResponse.json({ error: "Only this appointment's doctor and patient can join." }, { status: 403 });
  const { parties, role } = access;
  if (parties.appointment.status === "cancelled")
    return NextResponse.json({ error: "This appointment was cancelled." }, { status: 409 });

  const consultation = await getOrCreateConsultation(db, parties.appointment.id, parties.doctor.id, parties.patient.id);
  return NextResponse.json({
    role,
    room: visitRoomKey(parties.appointment.id),
    ice_servers: iceServers(),
    consultation_id: consultation?.id ?? null,
    consent: {
      doctor: consultation?.call_recording_consent_doctor ?? null,
      patient: consultation?.call_recording_consent_patient ?? null,
    },
    appointment: {
      id: parties.appointment.id,
      date: parties.appointment.appointment_date,
      time: parties.appointment.appointment_time,
      status: parties.appointment.status,
      symptoms: role === "doctor" ? parties.appointment.symptoms_description : null,
      triage_summary:
        role === "doctor" ? ((parties.appointment.ai_symptom_analysis as Record<string, unknown> | null)?.triage_summary ?? null) : null,
    },
    me: role === "doctor" ? displayDoctorName(parties.doctor.full_name) : parties.patient.full_name,
    other: role === "doctor" ? parties.patient.full_name : displayDoctorName(parties.doctor.full_name),
    phone_call_available: twilioConfigured(),
  });
}
