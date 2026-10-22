import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { countDoctorsByStatus, listDoctorsByStatus } from "@/lib/clinical";
import { runPresenceSweep } from "@/lib/presenceSweep";
import type { RegistrationStatus } from "@/types";

const VALID_STATUSES: RegistrationStatus[] = ["pending", "under_review", "verified", "rejected", "suspended"];

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  await runPresenceSweep();

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status: RegistrationStatus = VALID_STATUSES.includes(statusParam as RegistrationStatus)
    ? (statusParam as RegistrationStatus)
    : "pending";

  const [doctors, counts] = await Promise.all([listDoctorsByStatus(status), countDoctorsByStatus()]);
  return NextResponse.json({ doctors, counts });
}
