import { NextResponse } from "next/server";
import { presenceOfflineSchema } from "@/lib/schemas";
import { getDoctorByUserId, markDoctorOffline } from "@/lib/clinical";
import { getUserFromAccessToken } from "@/lib/serverAuth";

// navigator.sendBeacon (used on beforeunload — see hooks/useDoctorPresence.ts)
// cannot set an Authorization header, so this is the one route in the app
// that reads the access token from the JSON body instead of a bearer header.
// It updates only the caller's doctor row.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = presenceOfflineSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const auth = await getUserFromAccessToken(parsed.data.access_token);
  if (!auth) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

  const doctor = await getDoctorByUserId(auth.db, auth.user.id);
  if (!doctor) return NextResponse.json({ error: "No doctor profile found." }, { status: 404 });

  await markDoctorOffline(auth.db, doctor.id, "logout");
  return NextResponse.json({ ok: true });
}
