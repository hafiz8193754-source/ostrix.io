"use client";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Composer, type AttachmentMode } from "@/components/chat/Composer";
import type { AgentMode } from "@/types";

interface Suggestion {
  mode: AgentMode;
  label: string;
  prefill?: string;
}

const BUILDER_SUGGESTIONS: Suggestion[] = [
  { mode: "builder", label: "Restaurant website for a Karachi cafe", prefill: "Restaurant website for a Karachi cafe" },
  { mode: "builder", label: "Portfolio for a photographer", prefill: "Portfolio for a photographer" },
  { mode: "builder", label: "SaaS landing page with pricing", prefill: "SaaS landing page with pricing" },
];

const FARM_SUGGESTIONS: Suggestion[] = [
  { mode: "farm", label: "Wheat plan for Faisalabad, 5 acres" },
  { mode: "farm", label: "Cotton advisory for Multan, 10 acres" },
  { mode: "farm", label: "Rice farming plan for Gujranwala" },
];

interface EmptyStateProps {
  onSelectSuggestion: (mode: AgentMode, prefill?: string, autoSubmit?: boolean) => void;
  mode: AgentMode;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  loading?: boolean;
  screenshotPreview?: string | null;
  onAttach?: (file: File) => void;
  onRemoveAttachment?: () => void;
  attachmentMode?: AttachmentMode;
  onAttachmentModeChange?: (mode: AttachmentMode) => void;
}

export function EmptyState({
  onSelectSuggestion,
  mode,
  value,
  onChange,
  onSend,
  loading,
  screenshotPreview,
  onAttach,
  onRemoveAttachment,
  attachmentMode,
  onAttachmentModeChange,
}: EmptyStateProps) {
  const screenshotMode = mode === "builder" && attachmentMode === "screenshot";

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <OstrixLogo size="lg" withWordmark />
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">
          {screenshotMode ? "Drop a screenshot of any website" : "What can I help you build?"}
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {screenshotMode
            ? "Ostrix will rebuild it, better."
            : "Describe a website, upload a screenshot, or switch to Farm Advisor below."}
        </p>
      </div>

      <Composer
        variant="hero"
        mode={mode}
        value={value}
        onChange={onChange}
        onSend={onSend}
        loading={loading}
        screenshotPreview={screenshotPreview}
        onAttach={onAttach}
        onRemoveAttachment={onRemoveAttachment}
        attachmentMode={attachmentMode}
        onAttachmentModeChange={onAttachmentModeChange}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          {BUILDER_SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => onSelectSuggestion(s.mode, s.prefill, true)}
              className="rounded-full border border-border bg-bg-elevated px-3.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {FARM_SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => onSelectSuggestion(s.mode, s.prefill, false)}
              className="rounded-full border border-border bg-bg-elevated px-3.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
