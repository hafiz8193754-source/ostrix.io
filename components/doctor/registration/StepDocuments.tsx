"use client";

import { useRef, useState } from "react";
import { Paperclip, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { readPhoto } from "@/lib/image";
import type { RegistrationAnswers, StepProps } from "./types";
import { StepFooter } from "./StepFooter";

type DocKey = "pmdc_certificate_url" | "degree_certificate_url" | "cnic_front_url" | "profile_photo_url";

const DOCS: { key: DocKey; label: string; required: boolean }[] = [
  { key: "pmdc_certificate_url", label: "PMDC certificate", required: true },
  { key: "degree_certificate_url", label: "Degree certificate (MBBS/specialist)", required: true },
  { key: "cnic_front_url", label: "CNIC front", required: true },
  { key: "profile_photo_url", label: "Profile photo (optional)", required: false },
];

const MAX_BYTES = 5 * 1024 * 1024;

// Documents upload straight from the browser to the private "doctor-documents"
// Supabase Storage bucket — there's no server-side multipart handling
// anywhere in this app, so this mirrors the existing client-side image
// processing pattern (lib/image.ts) instead of inventing one. Only the
// resulting object PATH (not a public URL — the bucket is private) is stored
// on the doctor row; anything that needs to display a document later
// generates a short-lived signed URL from that path on demand.
export function StepDocuments({ values, onChange, onNext, onBack }: StepProps) {
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Partial<Record<DocKey, HTMLInputElement | null>>>({});

  const canContinue = !!values.pmdc_certificate_url && !!values.degree_certificate_url && !!values.cnic_front_url;

  async function handleFile(key: DocKey, file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Files must be under 5MB.");
      return;
    }
    if (!/^image\/(png|jpe?g|webp)$|^application\/pdf$/.test(file.type)) {
      setError("Only JPG, PNG, or PDF files are accepted.");
      return;
    }
    setUploading(key);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You're not signed in.");

      let uploadBlob: Blob = file;
      let ext = (file.name.split(".").pop() || "bin").toLowerCase();
      let contentType = file.type;

      if (file.type.startsWith("image/")) {
        const resized = await readPhoto(file, 1600);
        uploadBlob = await (await fetch(resized.preview)).blob();
        ext = "jpg";
        contentType = "image/jpeg";
      }

      const path = `${userId}/${key.replace("_url", "")}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("doctor-documents")
        .upload(path, uploadBlob, { upsert: true, contentType });
      if (uploadError) throw uploadError;

      onChange({ [key]: path } as Partial<RegistrationAnswers>);
    } catch (e) {
      setError((e as Error).message || "Upload failed.");
    }
    setUploading(null);
  }

  function handleNext() {
    if (canContinue) onNext();
    else setError("Upload your PMDC certificate, degree certificate, and CNIC to continue.");
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-text-primary">Documents</h2>
        <p className="text-xs text-text-muted">JPG, PNG, or PDF — max 5MB each.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {DOCS.map((doc) => {
          const value = values[doc.key];
          const isUploading = uploading === doc.key;
          return (
            <div key={doc.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                {value ? <Check className="h-4 w-4 text-emerald-500" /> : <Paperclip className="h-4 w-4 text-text-muted" />}
                <span>
                  {doc.label}
                  {doc.required && <span className="text-red-500"> *</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {value && (
                  <button type="button" onClick={() => onChange({ [doc.key]: "" } as Partial<RegistrationAnswers>)} className="text-text-muted hover:text-text-primary" aria-label="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileRefs.current[doc.key]?.click()}
                  disabled={isUploading}
                  className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-secondary hover:border-accent hover:text-text-primary disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : value ? "Replace" : "Upload"}
                </button>
                <input
                  ref={(el) => {
                    fileRefs.current[doc.key] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) handleFile(doc.key, file);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <StepFooter onBack={onBack} onNext={handleNext} canContinue nextLabel="Continue" loading={!!uploading} />
    </div>
  );
}
