import { createClient } from "@supabase/supabase-js";

import type { Profile, ProfileSettings } from "@/types";

// Server-only Supabase client (service role) — same per-file convention as
// lib/serverAuth.ts / lib/clinical.ts / lib/notifications.ts.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
    { auth: { persistSession: false } }
  );
}

export async function getOrCreateProfile(userId: string): Promise<Profile> {
  const admin = adminClient();
  const { data: existing } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing) return existing as Profile;

  const { data, error } = await admin.from("profiles").insert({ id: userId }).select("*").single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

interface ProfilePatch {
  display_name?: string;
  avatar_url?: string;
  settings?: Partial<ProfileSettings>;
}

// Merges `settings` shallowly rather than replacing it wholesale — each
// Settings section (Appearance, Language, Chat, API Keys) saves independently
// and must not clobber the others' values.
export async function updateProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const admin = adminClient();
  const current = await getOrCreateProfile(userId);
  const mergedSettings: ProfileSettings = { ...current.settings, ...(patch.settings || {}) };

  const { data, error } = await admin
    .from("profiles")
    .update({
      display_name: patch.display_name !== undefined ? patch.display_name : current.display_name,
      avatar_url: patch.avatar_url !== undefined ? patch.avatar_url : current.avatar_url,
      settings: mergedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export async function deleteAllChatHistory(userId: string): Promise<void> {
  const admin = adminClient();
  // messages cascade-delete via the sessions FK.
  await admin.from("sessions").delete().eq("user_id", userId);
}
