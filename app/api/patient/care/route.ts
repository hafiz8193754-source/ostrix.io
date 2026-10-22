import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { listPatientCare } from "@/lib/clinical";

// The signed-in patient's own appointments and approved prescriptions.
export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const care = await listPatientCare(auth.db, auth.user.id);
  return NextResponse.json(care);
}
