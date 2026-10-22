import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getPrescription, getDoctorById, getPatientById } from "@/lib/clinical";

// The signature image used on a SIGNED prescription. Private bucket; served
// only to that prescription's patient or doctor.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;
  const rx = await getPrescription(db, params.id);
  if (!rx || rx.status !== "approved" || !rx.signature_path) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [doctor, patient] = await Promise.all([getDoctorById(db, rx.doctor_id), getPatientById(db, rx.patient_id)]);
  if (user.id !== doctor?.user_id && user.id !== patient?.user_id) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const { data, error } = await db.storage.from("signatures").download(rx.signature_path);
  if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(Buffer.from(await data.arrayBuffer()), { headers: { "content-type": "image/png", "cache-control": "private, max-age=300" } });
}
