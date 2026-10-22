import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { requireServiceClient } from "@/lib/serverAuth";
import { countPaymentsByStatus, listPaymentsForAdmin } from "@/lib/payments";
import type { Payment } from "@/types";

const VALID: Payment["status"][] = ["pending", "approved", "rejected"];

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const param = new URL(request.url).searchParams.get("status") as Payment["status"];
  const status = VALID.includes(param) ? param : "pending";
  const admin = requireServiceClient();
  const [payments, counts] = await Promise.all([listPaymentsForAdmin(admin, status), countPaymentsByStatus(admin)]);
  return NextResponse.json({ payments, counts });
}
