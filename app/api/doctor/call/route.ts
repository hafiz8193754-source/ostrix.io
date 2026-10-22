import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { callStartSchema } from "@/lib/schemas";
import { getAppointmentWithParties, createConsultation, saveConsultationCallSid, logClinicalAudit } from "@/lib/clinical";
import { twilioClient, twilioConfigured } from "@/lib/twilio";

// Real Twilio Voice conference bridge — replaces the earlier stub. Places
// two outbound calls (doctor + patient), each joining the same conference
// after hearing a consent/recording notice, so neither party ever sees the
// other's real number. Either party can trigger this once for both legs.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = callStartSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const parties = await getAppointmentWithParties(parsed.data.appointment_id);
  if (!parties) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });

  if (user.id !== parties.doctor.user_id && user.id !== parties.patient.user_id)
    return NextResponse.json({ error: "You're not part of this appointment." }, { status: 403 });

  if (!parties.doctor.phone || !parties.patient.phone)
    return NextResponse.json({ error: "Missing a phone number for the doctor or patient." }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !twilioConfigured())
    return NextResponse.json(
      { error: "Calling isn't configured yet — TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER or NEXT_PUBLIC_APP_URL are missing." },
      { status: 503 }
    );

  const consultation = await createConsultation(parties.appointment.id, parties.doctor.id, parties.patient.id);
  if (!consultation) return NextResponse.json({ error: "Could not start the consultation." }, { status: 500 });

  const consultationId = consultation.id;
  const conferenceName = `consultation-${consultationId}`;
  const client = twilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER as string;

  function twimlUrl(role: "doctor" | "patient") {
    const u = new URL(`${appUrl}/api/doctor/call/twiml`);
    u.searchParams.set("conference", conferenceName);
    u.searchParams.set("role", role);
    u.searchParams.set("consultation", consultationId);
    return u.toString();
  }

  try {
    const doctorCall = await client.calls.create({
      to: parties.doctor.phone,
      from,
      url: twimlUrl("doctor"),
      statusCallback: `${appUrl}/api/doctor/call/status?consultation=${consultation.id}`,
      statusCallbackEvent: ["completed"],
    });
    await client.calls.create({
      to: parties.patient.phone,
      from,
      url: twimlUrl("patient"),
      statusCallback: `${appUrl}/api/doctor/call/status?consultation=${consultation.id}`,
      statusCallbackEvent: ["completed"],
    });

    await saveConsultationCallSid(consultation.id, doctorCall.sid);
    await logClinicalAudit(consultation.id, null, "system", "call_initiated", { conferenceName, callSid: doctorCall.sid });

    return NextResponse.json({ consultation_id: consultation.id, status: "calling" });
  } catch (e) {
    return NextResponse.json({ error: `Could not place the call: ${(e as Error).message}` }, { status: 502 });
  }
}
