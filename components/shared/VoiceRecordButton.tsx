"use client";

import { Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

interface VoiceRecordButtonProps {
  accessToken: string;
  onTranscribed: (text: string) => void;
}

// Press-and-hold to record, matching the spec's mic button — releasing
// immediately stops and transcribes, filling the caller's text field so the
// user can review/edit before sending (never auto-submitted). Shared by any
// agent's conversational intake (Doctor, Farm) — nothing here is agent-specific.
export function VoiceRecordButton({ accessToken, onTranscribed }: VoiceRecordButtonProps) {
  const { isRecording, isTranscribing, error, startRecording, stopRecording } = useVoiceRecorder({ accessToken, onTranscribed });

  return (
    <div className="relative flex shrink-0 items-center">
      <button
        type="button"
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={() => isRecording && stopRecording()}
        disabled={isTranscribing}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
          isRecording
            ? "animate-pulse border-red-500 bg-red-500/10 text-red-500"
            : "border-border bg-bg-elevated text-text-secondary hover:text-text-primary"
        )}
        aria-label="Hold to record"
        title="Hold to record"
      >
        {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
      </button>
      {error && <span role="status" className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded bg-bg-surface px-1.5 text-[11px] text-red-500 shadow-card">{error}</span>}
    </div>
  );
}
