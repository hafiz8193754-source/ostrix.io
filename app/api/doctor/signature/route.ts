import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedDoctor } from "@/lib/doctorGuard";
import { saveDoctorSignature } from "@/lib/clinical";

const schema = z.object({ signature_path: z.string().trim().min(1) });

// Called after the doctor's browser has already uploaded a freshly drawn
// signature PNG to the private "signatures" bucket — this just records the
// path on their profile so it can be reused (with a signed URL) on future approvals.
export async function POST(request: Request) {
  const guard = await requireVerifiedDoctor(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  await saveDoctorSignature(guard.db, guard.doctor.id, parsed.data.signature_path);
  return NextResponse.json({ ok: true, signature_url: parsed.data.signature_path });
}
