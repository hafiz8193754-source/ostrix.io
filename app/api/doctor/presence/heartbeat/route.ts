import { NextResponse } from "next/server";
import { adminConfigGate, getUserFromRequest } from "@/lib/serverAuth";
import { heartbeatSchema } from "@/lib/schemas";
import { getDoctorByUserId, recordHeartbeat } from "@/lib/clinical";

// Not gated by requireVerifiedDoctor — presence has no legal weight and an
// unverified doctor is still offline/unbookable regardless of what this
// route does (lib/presence.ts's pmdc_verified gate is absolute).
export async function POST(request: Request) {
  const gate = adminConfigGate(await getUserFromRequest(request));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const doctor = await getDoctorByUserId(gate.user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found for this account." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const result = await recordHeartbeat(doctor.id, parsed.data.status, parsed.data.reset_override);
  if (!result) return NextResponse.json({ error: "Could not record heartbeat." }, { status: 500 });

  return NextResponse.json({
    availability_status: result.presence.status,
    is_online: true,
    next_schedule_block: result.presence.next_available,
  });
}
