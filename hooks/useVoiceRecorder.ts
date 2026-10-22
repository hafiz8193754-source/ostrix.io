"use client";

import { useRef, useState } from "react";

interface UseVoiceRecorderOptions {
  accessToken: string;
  onTranscribed: (text: string) => void;
}

// Press-and-hold MediaRecorder wrapper. On release, uploads the recorded
// blob to /api/transcribe and hands the transcribed text back via
// onTranscribed — the caller drops it into an editable field rather than
// auto-sending, so the user can confirm/correct before it's used.
export function useVoiceRecorder({ accessToken, onTranscribed }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function handleStop() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    if (!blob.size) return;

    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not transcribe.");
      onTranscribed(data.text || "");
    } catch (e) {
      setError((e as Error).message);
    }
    setIsTranscribing(false);
  }

  async function startRecording() {
    if (isRecording) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop;
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
  }

  return { isRecording, isTranscribing, error, startRecording, stopRecording };
}
