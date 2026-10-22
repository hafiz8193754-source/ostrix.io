import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminConfigGate, getUserFromRequest, requireServiceClient } from "@/lib/serverAuth";
import { deleteAccountSchema } from "@/lib/schemas";

// Personal storage folders ("<uid>/…") removed outright on account deletion.
const USER_BUCKETS = ["avatars", "doctor-documents", "signatures", "payment-receipts"];

async function removeFolder(admin: SupabaseClient, bucket: string, folder: string) {
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  const paths = (data || []).map((f) => `${folder}/${f.name}`);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

// Deletes the Supabase auth user, but medical records are kept anonymized:
// anonymize_account() strips identifiers from the patient/doctor rows and
// detaches them (user_id -> NULL), so appointments, consultations,
// prescriptions, payments, voice notes and the audit log survive without personal data.
// Chats, profile, notifications and personal files are still wiped.
export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  const gate = adminConfigGate(auth?.user ?? null);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json();
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Type "DELETE" to confirm.' }, { status: 400 });

  const admin = requireServiceClient();
  const uid = gate.user.id;

  const { data: anon, error: anonError } = await admin.rpc("anonymize_account", { target: uid });
  if (anonError) return NextResponse.json({ error: "Could not delete your account." }, { status: 500 });

  const doctorIds: string[] = (anon as { doctors?: string[] } | null)?.doctors || [];
  const pdfs: string[] = (anon as { pdfs?: string[] } | null)?.pdfs || [];
  try {
    await Promise.all([
      ...USER_BUCKETS.map((b) => removeFolder(admin, b, uid)),
      ...doctorIds.map((id) => removeFolder(admin, "doctor-documents", id)),
      pdfs.length ? admin.storage.from("prescriptions").remove(pdfs) : Promise.resolve(),
    ]);
  } catch {
    // Files are best-effort; the records are already anonymized.
  }

  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return NextResponse.json({ error: "Could not delete your account." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
