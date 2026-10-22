import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { profileSettingsSchema } from "@/lib/schemas";
import { getOrCreateProfile, updateProfile } from "@/lib/profiles";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const profile = await getOrCreateProfile(user.id);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = profileSettingsSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });

  const profile = await updateProfile(user.id, parsed.data);
  return NextResponse.json({ profile });
}
