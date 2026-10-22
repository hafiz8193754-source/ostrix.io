import { NextResponse } from "next/server";
import { adminConfigGate, getUserFromRequest, requireServiceClient } from "@/lib/serverAuth";
import { deleteAccountSchema } from "@/lib/schemas";

// Deletes the Supabase auth user outright — every table referencing
// auth.users(id) (profiles, sessions → messages, generations, doctors,
// patients, notifications, …) is declared `on delete cascade`, so this one
// call is the complete account wipe.
export async function POST(request: Request) {
  const gate = adminConfigGate(await getUserFromRequest(request));
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json();
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Type "DELETE" to confirm.' }, { status: 400 });

  const admin = requireServiceClient();
  const { error } = await admin.auth.admin.deleteUser(gate.user.id);
  if (error) return NextResponse.json({ error: "Could not delete your account." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
