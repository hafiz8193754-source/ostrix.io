"use client";

import { useRef, useState } from "react";
import { FileText, Link2, Paperclip, X } from "lucide-react";

import type { PendingFileAttachment } from "@/types";

interface AttachmentBarProps {
  attachments: PendingFileAttachment[];
  url: string;
  error?: string;
  onFilesSelected: (files: FileList) => void;
  onRemoveAttachment: (index: number) => void;
  onUrlChange: (url: string) => void;
  onRemoveUrl: () => void;
  disabled?: boolean;
}

// Prompt Engineer's file/URL intake — sits above the Composer. Images, PDFs,
// and one reference link can be queued together and travel with the next
// message; nothing here is sent until the user hits Send.
export function AttachmentBar({
  attachments,
  url,
  error,
  onFilesSelected,
  onRemoveAttachment,
  onUrlChange,
  onRemoveUrl,
  disabled,
}: AttachmentBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlFieldOpen, setUrlFieldOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (files && files.length) onFilesSelected(files);
  }

  function commitUrl() {
    if (urlDraft.trim()) onUrlChange(urlDraft.trim());
    setUrlDraft("");
    setUrlFieldOpen(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-3 sm:px-6">
      {(attachments.length > 0 || url) && (
        <div className="flex flex-wrap items-center gap-2">
          {attachments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated py-1 pl-1 pr-2">
              {a.kind === "image" && a.preview ? (
                <img src={a.preview} alt={a.name} className="h-7 w-7 rounded object-cover" />
              ) : (
                <FileText className="h-4 w-4 text-text-muted" />
              )}
              <span className="max-w-[140px] truncate text-xs text-text-secondary">{a.name}</span>
              <button onClick={() => onRemoveAttachment(i)} className="text-text-muted hover:text-text-primary" aria-label="Remove attachment">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {url && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated py-1 pl-2 pr-2">
              <Link2 className="h-3.5 w-3.5 text-text-muted" />
              <span className="max-w-[200px] truncate text-xs text-text-secondary">{url}</span>
              <button onClick={onRemoveUrl} className="text-text-muted hover:text-text-primary" aria-label="Remove link">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5" /> Attach files
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />

        {!urlFieldOpen ? (
          <button
            type="button"
            onClick={() => setUrlFieldOpen(true)}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" /> Paste a link
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitUrl();
                }
                if (e.key === "Escape") {
                  setUrlDraft("");
                  setUrlFieldOpen(false);
                }
              }}
              placeholder="https://example.com"
              className="h-8 w-56 rounded-lg border border-border bg-bg-elevated px-2.5 text-xs text-text-primary outline-none focus-visible:border-accent"
            />
            <button
              type="button"
              onClick={commitUrl}
              className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-black hover:bg-accent-hover"
            >
              Add
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
