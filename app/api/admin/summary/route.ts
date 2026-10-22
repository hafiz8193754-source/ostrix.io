import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { requireServiceClient } from "@/lib/serverAuth";
import { countDoctorsByStatus } from "@/lib/clinical";
import { countPaymentsByStatus } from "@/lib/payments";

// Admin-only counts for the /admin hub summary cards and the nav "Admin" link.
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [doctors, payments] = await Promise.all([countDoctorsByStatus(), countPaymentsByStatus(requireServiceClient())]);
  return NextResponse.json({ pendingDoctors: doctors.pending || 0, pendingPayments: payments.pending || 0 });
}
