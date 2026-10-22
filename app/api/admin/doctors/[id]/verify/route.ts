import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { adminVerifyActionSchema } from "@/lib/schemas";
import { approveDoctor, rejectDoctor, requestMoreInfo, suspendDoctor, VERIFICATION_CHECKLIST_ITEMS } from "@/lib/clinical";

interface RouteParams {
  params: { id: string };
}

// The only route in the app that can flip pmdc_verified to true — gated on
// requireAdmin, and "approve" additionally requires every checklist item
// (re-verified server-side against VERIFICATION_CHECKLIST_ITEMS, not trusted
// from the client's array length alone).
export async function POST(request: Request, { params }: RouteParams) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await request.json();
  const parsed = adminVerifyActionSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const doctorId = params.id;
  const data = parsed.data;

  if (data.action === "approve") {
    const requiredKeys = VERIFICATION_CHECKLIST_ITEMS.map((i) => i.key);
    const allTicked = requiredKeys.every((k) => data.checklist.includes(k));
    if (!allTicked) return NextResponse.json({ error: "Complete every checklist item before approving." }, { status: 400 });
    const doctor = await approveDoctor(doctorId, guard.user.id);
    if (!doctor) return NextResponse.json({ error: "Could not approve this doctor." }, { status: 500 });
    return NextResponse.json({ doctor });
  }

  if (data.action === "request_info") {
    const doctor = await requestMoreInfo(doctorId, guard.user.id, data.note);
    if (!doctor) return NextResponse.json({ error: "Could not update this doctor." }, { status: 500 });
    return NextResponse.json({ doctor });
  }

  if (data.action === "reject") {
    const doctor = await rejectDoctor(doctorId, guard.user.id, data.reason);
    if (!doctor) return NextResponse.json({ error: "Could not reject this doctor." }, { status: 500 });
    return NextResponse.json({ doctor });
  }

  // action === "suspend"
  const result = await suspendDoctor(doctorId, guard.user.id, data.reason);
  if (!result) return NextResponse.json({ error: "Could not suspend this doctor." }, { status: 500 });
  return NextResponse.json(result);
}
