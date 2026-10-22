import { NextResponse } from "next/server";
import { getUserFromRequest, hasServiceRoleKey, requireServiceClient } from "@/lib/serverAuth";
import { paymentSubmitSchema } from "@/lib/schemas";
import { listOwnPayments } from "@/lib/payments";
import { createNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ payments: await listOwnPayments(auth.db, auth.user.id) });
}

// Patient reports a bank transfer for one of their appointments. RLS only
// lets them insert a 'pending' row for their own appointment; a trigger moves
// the appointment's payment_status to 'pending'.
export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const parsed = paymentSubmitSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { appointment_id, transfer_reference, receipt_path } = parsed.data;

  if (receipt_path && !receipt_path.startsWith(`${user.id}/`))
    return NextResponse.json({ error: "Invalid receipt file." }, { status: 400 });

  const { data: appt } = await db.from("appointments").select("id, patient_id, fee_pkr, payment_status, status").eq("id", appointment_id).maybeSingle();
  if (!appt) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  if (!["unpaid", "rejected"].includes(appt.payment_status))
    return NextResponse.json({ error: appt.payment_status === "pending" ? "A payment is already awaiting review." : "No payment is due for this appointment." }, { status: 409 });
  if (appt.status === "cancelled") return NextResponse.json({ error: "This appointment was cancelled." }, { status: 409 });

  const { data: payment, error } = await db
    .from("payments")
    .insert({ appointment_id, patient_id: appt.patient_id, payer_user_id: user.id, amount_pkr: appt.fee_pkr, transfer_reference, receipt_path: receipt_path || null })
    .select("*")
    .single();
  if (error || !payment) return NextResponse.json({ error: "Could not submit your payment." }, { status: 500 });

  if (hasServiceRoleKey()) {
    try {
      const admin = requireServiceClient();
      const { data: admins } = await admin.from("platform_admins").select("user_id");
      await Promise.all(
        (admins || []).map((a) =>
          createNotification(admin, a.user_id, "payment_submitted", "New bank transfer", `PKR ${appt.fee_pkr} · ref ${transfer_reference}`, "/admin/payments")
        )
      );
    } catch {
      // Admins still see it in the queue.
    }
  }
  return NextResponse.json({ payment });
}
