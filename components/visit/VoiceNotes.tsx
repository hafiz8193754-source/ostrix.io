"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  sender_role: "doctor" | "patient";
  duration_seconds: number | null;
  transcript: string | null;
  transcript_error: string | null;
  created_at: string;
  audio_url: string | null;
  mine: boolean;
};

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

// Async voice messages for one appointment: record → preview → send. Each note
// is transcribed server-side (Grok STT) and visible to both doctor and patient.
export function VoiceNotes({ appointmentId, accessToken, refreshSignal, onSent }: { appointmentId: string; accessToken: string; refreshSignal?: number; onSent?: () => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const startedRef = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/visit/${appointmentId}/voice-notes`, { headers: { authorization: `Bearer ${accessToken}` } });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setNotes(data.notes);
    else setError(data.error || "Could not load voice messages.");
  }, [appointmentId, accessToken]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, refreshSignal]);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        setPending({ blob, url: URL.createObjectURL(blob), seconds: Math.round((Date.now() - startedRef.current) / 1000) });
      };
      startedRef.current = Date.now();
      rec.start(250);
      recRef.current = rec;
      setRecording(true);
    } catch {
      setError("Microphone permission is needed to record a voice message.");
    }
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function send() {
    if (!pending) return;
    setSending(true);
    setError("");
    const form = new FormData();
    form.append("audio", pending.blob, "voice-note.webm");
    form.append("duration_seconds", String(pending.seconds));
    const res = await fetch(`/api/visit/${appointmentId}/voice-notes`, { method: "POST", headers: { authorization: `Bearer ${accessToken}` }, body: form });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data.error || "Could not send.");
    setPending(null);
    onSent?.();
    load();
  }

  return (
    <section id="notes" data-testid="voice-notes" className="flex flex-col gap-3 rounded-xl border border-border bg-bg-surface p-4">
      <h2 className="font-display text-base font-bold text-text-primary">Voice messages</h2>
      <p className="text-xs text-text-muted">Send a voice note any time — it&apos;s transcribed automatically and both of you can see it. Not for emergencies: call 1122.</p>
      <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
        {notes === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
        ) : notes.length === 0 ? (
          <p className="text-xs text-text-muted">No voice messages yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} data-testid="voice-note" className={cn("flex max-w-[90%] flex-col gap-1 rounded-xl px-3 py-2 text-sm", n.mine ? "self-end bg-accent/15" : "self-start bg-bg-elevated")}>
              <span className="text-[11px] font-medium capitalize text-text-secondary">
                {n.mine ? "You" : n.sender_role} · {new Date(n.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "short", timeStyle: "short" })}
                {n.duration_seconds ? ` · ${n.duration_seconds}s` : ""}
              </span>
              {n.audio_url && <audio controls src={n.audio_url} className="h-8 w-full max-w-[260px]" />}
              <p data-testid="voice-note-transcript" className="text-xs text-text-primary">
                {n.transcript ? `“${n.transcript}”` : n.transcript_error ? "Transcript unavailable." : "(no speech detected)"}
              </p>
            </div>
          ))
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {pending ? (
        <div className="flex flex-wrap items-center gap-2">
          <audio controls src={pending.url} className="h-9 max-w-full flex-1" />
          <button onClick={() => setPending(null)} className="flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs text-text-secondary">
            <Trash2 className="h-3.5 w-3.5" /> Discard
          </button>
          <button data-testid="voice-note-send" onClick={send} disabled={sending} className="flex h-9 items-center gap-1 rounded-lg bg-accent px-3 text-xs font-medium text-accent-fg disabled:opacity-50">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
          </button>
        </div>
      ) : (
        <button
          data-testid="voice-note-record"
          onClick={recording ? stop : start}
          className={cn("flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium sm:self-start sm:px-4", recording ? "animate-pulse bg-red-600 text-white" : "border border-accent text-accent")}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {recording ? "Stop recording" : "Record voice message"}
        </button>
      )}
    </section>
  );
}
