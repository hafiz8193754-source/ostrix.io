import { NextResponse } from "next/server";

import { createAnonAuthClient } from "@/lib/serverAuth";
import { listApprovedDoctors } from "@/lib/publicDoctors";

export const dynamic = "force-dynamic";

// Public: approved doctors only, patient-safe columns.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctors = await listApprovedDoctors(createAnonAuthClient(), {
    specialization: searchParams.get("specialization") || undefined,
    city: searchParams.get("city") || undefined,
    q: searchParams.get("q") || undefined,
  });
  return NextResponse.json({ doctors });
}
