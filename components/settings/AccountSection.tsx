"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { readPhoto } from "@/lib/image";
import type { Profile } from "@/types";
import type { ProfilePatch } from "./SettingsModal";

interface AccountSectionProps {
  accessToken: string;
  userEmail: string;
  profile: Profile | null;
  onSave: (patch: ProfilePatch) => Promise<boolean>;
}

export function AccountSection({ accessToken, userEmail, profile, onSave }: AccountSectionProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSaveName() {
    setSaving(true);
    const ok = await onSave({ display_name: displayName.trim() });
    setSaving(false);
    setSaved(ok);
    setTimeout(() => setSaved(false), 1500);
  }

  // Uploads straight to the public "avatars" bucket, same client-side-upload
  // pattern StepDocuments.tsx already established for doctor documents —
  // just a public bucket here instead of a private one, since avatars are
  // meant to be publicly viewable.
  async function handleAvatarUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in.");

      const resized = await readPhoto(file, 400);
      const blob = await (await fetch(resized.preview)).blob();
      const path = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await onSave({ avatar_url: `${data.publicUrl}?t=${Date.now()}` });
    } catch (e) {
      setError((e as Error).message || "Upload failed.");
    }
    setUploading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ confirm: deleteConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete account.");
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (e) {
      setError((e as Error).message);
    }
    setDeleting(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Profile</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-bg-elevated"
            aria-label="Change avatar"
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm text-text-muted">
                {(displayName || userEmail).slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) handleAvatarUpload(f);
            }}
          />
          <div className="flex flex-1 items-center gap-2">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="h-9 flex-1 rounded-md border border-border bg-bg-elevated px-3 text-sm text-text-primary outline-none focus-visible:border-accent"
            />
            <button onClick={handleSaveName} disabled={saving} className="h-9 shrink-0 rounded-md bg-accent px-3 text-xs font-medium text-black disabled:opacity-50">
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-text-muted">{userEmail}</p>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      <div className="border-t border-border pt-4">
        <button onClick={handleSignOut} className="rounded-md border border-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary">
          Sign out
        </button>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-2 text-sm font-semibold text-red-500">Danger zone</h3>
        {!confirmingDelete ? (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-500 hover:bg-red-500/5"
          >
            Delete account
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3">
            <p className="text-xs text-text-secondary">This permanently deletes your account and all data. Type DELETE to confirm.</p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm text-text-primary outline-none focus-visible:border-accent"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== "DELETE"}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Permanently delete
              </button>
              <button onClick={() => setConfirmingDelete(false)} className="text-xs text-text-secondary hover:text-text-primary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
