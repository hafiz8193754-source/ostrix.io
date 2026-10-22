import type { SupabaseClient } from "@supabase/supabase-js";

import type { Profile, ProfileSettings } from "@/types";

export async function getOrCreateProfile(db: SupabaseClient, userId: string): Promise<Profile> {
  const { data: existing } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existing) return existing as Profile;

  const { data, error } = await db.from("profiles").insert({ id: userId }).select("*").single();
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
export async function updateProfile(db: SupabaseClient, userId: string, patch: ProfilePatch): Promise<Profile> {
  const current = await getOrCreateProfile(db, userId);
  const mergedSettings: ProfileSettings = { ...current.settings, ...(patch.settings || {}) };

  const { data, error } = await db
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

export async function deleteAllChatHistory(db: SupabaseClient, userId: string): Promise<void> {
  // messages cascade-delete via the sessions FK.
  await db.from("sessions").delete().eq("user_id", userId);
}
