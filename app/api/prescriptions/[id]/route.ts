import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getPrescription, getDoctorById, getPatientById } from "@/lib/clinical";

// One prescription for the printable view. Patients only ever get SIGNED
// prescriptions (drafts/revisions/superseded => 404, same as not existing).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;
  const rx = await getPrescription(db, params.id);
  if (!rx) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [doctor, patient] = await Promise.all([getDoctorById(db, rx.doctor_id), getPatientById(db, rx.patient_id)]);
  const isDoctor = !!doctor && doctor.user_id === user.id;
  const isPatient = !!patient && patient.user_id === user.id;
  if (!isDoctor && !isPatient) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (isPatient && !isDoctor && rx.status !== "approved") return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({
    prescription: rx,
    doctor: doctor && {
      id: doctor.id, full_name: doctor.full_name, specialization: doctor.specialization, qualifications: doctor.qualifications,
      pmdc_number: doctor.pmdc_number, clinic_name: doctor.clinic_name, clinic_address: doctor.clinic_address, city: doctor.city,
    },
    patient: patient && { full_name: patient.full_name, age: patient.age, gender: patient.gender },
  });
}
