import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { requireServiceClient } from "@/lib/serverAuth";
import { paymentReviewSchema } from "@/lib/schemas";
import { reviewPayment } from "@/lib/payments";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = paymentReviewSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await reviewPayment(requireServiceClient(), guard.user.id, params.id, parsed.data.action, parsed.data.note);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
