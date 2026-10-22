import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { presenceOfflineSchema } from "@/lib/schemas";
import { getDoctorByUserId, markDoctorOffline } from "@/lib/clinical";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { persistSession: false } }
  );
}

// navigator.sendBeacon (used on beforeunload — see hooks/useDoctorPresence.ts)
// cannot set an Authorization header, so this is the one route in the app
// that reads the access token from the JSON body instead of a bearer header.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = presenceOfflineSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(parsed.data.access_token);
  if (error || !data?.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const doctor = await getDoctorByUserId(data.user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });

  await markDoctorOffline(doctor.id, "logout");
  return NextResponse.json({ ok: true });
}
