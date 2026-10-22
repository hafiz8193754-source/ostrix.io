import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/lib/serverAuth";
import { deleteAccountSchema } from "@/lib/schemas";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { persistSession: false } }
  );
}

// Deletes the Supabase auth user outright — every table referencing
// auth.users(id) (profiles, sessions → messages, generations, doctors,
// patients, notifications, …) is declared `on delete cascade`, so this one
// call is the complete account wipe.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Type "DELETE" to confirm.' }, { status: 400 });

  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Could not delete your account." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
