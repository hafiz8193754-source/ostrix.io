import { NextResponse } from "next/server";

import { createAnonAuthClient } from "@/lib/serverAuth";
import { getApprovedDoctor, getDoctorSlots } from "@/lib/publicDoctors";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const db = createAnonAuthClient();
  const doctor = await getApprovedDoctor(db, params.id);
  if (!doctor) return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
  const days = await getDoctorSlots(db, doctor.id);
  return NextResponse.json({ doctor, days });
}
