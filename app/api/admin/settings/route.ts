import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { requireServiceClient } from "@/lib/serverAuth";
import { bankDetailsSchema } from "@/lib/schemas";
import { getBankDetails, saveBankDetails } from "@/lib/payments";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ bank: await getBankDetails(requireServiceClient()) });
}

export async function PUT(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = bankDetailsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details." }, { status: 400 });
  const bank = await saveBankDetails(requireServiceClient(), guard.user.id, parsed.data);
  if (!bank) return NextResponse.json({ error: "Could not save bank details." }, { status: 500 });
  return NextResponse.json({ bank });
}
