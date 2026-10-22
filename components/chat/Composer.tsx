"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X, ChevronDown, ImageIcon, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AgentMode } from "@/types";

export type AttachmentMode = "reference" | "screenshot";

interface ComposerProps {
  mode: AgentMode;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading?: boolean;
  /** "hero" = centered, borderless, larger — used on a fresh empty chat.
   *  "dock" = fixed bottom bar — used once the thread has messages. */
  variant?: "hero" | "dock";
  screenshotPreview?: string | null;
  onAttach?: (file: File) => void;
  onRemoveAttachment?: () => void;
  attachmentMode?: AttachmentMode;
  onAttachmentModeChange?: (mode: AttachmentMode) => void;
  /** True when there's queued content (e.g. Prompt Engineer file/URL attachments)
   *  that alone justifies enabling Send, even with no typed text yet. */
  hasPendingContent?: boolean;
}

const MAX_TEXTAREA_HEIGHT = 200;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

function SunSendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="12"
          x2="12"
          y2="2.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function Composer({
  mode,
  value,
  onChange,
  onSend,
  loading,
  variant = "dock",
  screenshotPreview,
  onAttach,
  onRemoveAttachment,
  attachmentMode = "reference",
  onAttachmentModeChange,
  hasPendingContent = false,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const isFarm = mode === "farm";
  const isDoctor = mode === "doctor";
  const isHero = variant === "hero";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onAttach) return;
    if (file.size > MAX_SCREENSHOT_BYTES) return;
    onAttach(file);
  }

  return (
    <div className={isHero ? "w-full" : "border-t border-border bg-bg-surface px-4 py-4 pb-6 sm:px-6"}>
      <div
        className={cn(
          "mx-auto flex flex-col gap-2",
          isHero ? "max-w-2xl rounded-2xl border border-border bg-bg-surface p-3 shadow-lg shadow-black/5" : "max-w-3xl"
        )}
      >
        {screenshotPreview && (
          <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-bg-elevated p-1.5 pr-2">
            <img src={screenshotPreview} alt="Attached screenshot" className="h-10 w-10 rounded object-cover" />
            <span className="text-xs text-text-secondary">
              {attachmentMode === "screenshot" ? "Rebuilding this site" : "Using as reference"}
            </span>
            <button onClick={onRemoveAttachment} className="text-text-muted hover:text-text-primary" aria-label="Remove attachment">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2.5">
          {!isFarm && !isDoctor && onAttach && (
            <div className="relative flex shrink-0 items-stretch">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-10 items-center gap-0.5 rounded-l-lg border border-r-0 border-border pl-2.5 pr-1 text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                aria-label={attachmentMode === "screenshot" ? "Attach a screenshot to rebuild" : "Attach a reference image"}
                title={attachmentMode === "screenshot" ? "Screenshot to site" : "Reference image"}
              >
                {attachmentMode === "screenshot" ? <Wand2 className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
              </button>
              {onAttachmentModeChange && (
                <button
                  type="button"
                  onClick={() => setModeMenuOpen((o) => !o)}
                  className="flex h-10 w-5 items-center justify-center rounded-r-lg border border-border text-text-muted transition-colors hover:border-accent hover:text-text-primary"
                  aria-label="Choose attachment mode"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />

              {modeMenuOpen && onAttachmentModeChange && (
                <div className="absolute bottom-full left-0 z-20 mb-1.5 w-56 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      onAttachmentModeChange("reference");
                      setModeMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg-elevated",
                      attachmentMode === "reference" ? "text-accent" : "text-text-secondary"
                    )}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>
                      <span className="block font-medium">Reference image</span>
                      <span className="block text-text-muted">Use as design inspiration</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAttachmentModeChange("screenshot");
                      setModeMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-bg-elevated",
                      attachmentMode === "screenshot" ? "text-accent" : "text-text-secondary"
                    )}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>
                      <span className="block font-medium">Screenshot to site</span>
                      <span className="block text-text-muted">Rebuild this exact website</span>
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            value={isFarm || isDoctor ? "" : value}
            disabled={isFarm || isDoctor}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isFarm
                ? "Use the form above to describe your farming situation"
                : isDoctor
                  ? "Use the health assistant above to describe your symptoms"
                  : attachmentMode === "screenshot" && screenshotPreview
                    ? "Any changes or additions? (optional)"
                    : "Describe the website or app you need…"
            }
            className="max-h-[200px] min-h-14 flex-1 resize-none rounded-2xl border border-border bg-bg-elevated px-5 py-4 text-[15px] leading-[1.5] text-text-primary placeholder:text-text-muted outline-none transition-colors focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            onClick={onSend}
            disabled={
              isFarm || isDoctor || loading || (!value.trim() && !(attachmentMode === "screenshot" && screenshotPreview) && !hasPendingContent)
            }
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-accent text-black shadow-glow transition-all hover:scale-105 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:scale-100"
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SunSendIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
