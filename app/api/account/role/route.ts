import { NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest, createUserClient } from "@/lib/serverAuth";
import { destinationFor, inferRole, loadRoleFacts } from "@/lib/accountRole";

export const dynamic = "force-dynamic";

async function facts(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return null;
  // Own-row reads/writes go through the caller's JWT so RLS (and the
  // account_role lock trigger) apply. Admins can read their own
  // platform_admins row under RLS, which is all the admin check needs.
  const db = createUserClient(auth.token);
  const f = await loadRoleFacts(db, db, auth.user.id);
  return { auth: { ...auth, db }, f };
}

// GET: the caller's role (null = not chosen yet) and where to send them.
// Existing doctors/patients without a stored choice get it inferred and saved
// once, so they are never asked to pick.
export async function GET(request: Request) {
  const r = await facts(request);
  if (!r) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { auth, f } = r;
  const role = inferRole(f);
  if ((role === "doctor" || role === "patient") && !f.stored) {
    await auth.db.from("profiles").upsert({ id: auth.user.id, account_role: role }, { onConflict: "id" });
  }
  return NextResponse.json({ role, destination: destinationFor(role, f.hasDoctorProfile) });
}

const body = z.object({ role: z.enum(["patient", "doctor"]) });

// POST: first-time choice only. Admin is not a choosable value, and an
// existing role is never overwritten here.
export async function POST(request: Request) {
  const r = await facts(request);
  if (!r) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { auth, f } = r;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose patient or doctor." }, { status: 400 });

  const current = inferRole(f);
  if (current) {
    return NextResponse.json(
      { error: "Your account already has a role.", role: current, destination: destinationFor(current, f.hasDoctorProfile) },
      { status: 409 },
    );
  }
  const { error } = await auth.db
    .from("profiles")
    .upsert({ id: auth.user.id, account_role: parsed.data.role }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: "Could not save your choice." }, { status: 500 });
  return NextResponse.json({ role: parsed.data.role, destination: destinationFor(parsed.data.role, f.hasDoctorProfile) });
}
