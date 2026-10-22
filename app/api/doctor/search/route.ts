import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { searchDoctors } from "@/lib/clinical";
import { runPresenceSweep } from "@/lib/presenceSweep";

// GET /api/doctor/search?specialization=&city=&online_only=&available_now=
export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  await runPresenceSweep();

  const { searchParams } = new URL(request.url);
  const doctors = await searchDoctors(db, {
    specialization: searchParams.get("specialization") || undefined,
    city: searchParams.get("city") || undefined,
    online_only: searchParams.get("online_only") === "true",
    available_now: searchParams.get("available_now") === "true",
  });

  return NextResponse.json({ doctors });
}
