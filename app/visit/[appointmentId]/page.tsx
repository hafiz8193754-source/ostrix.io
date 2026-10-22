"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { RealtimeChannel, Session as SupabaseSession } from "@supabase/supabase-js";
import { ArrowLeft, Loader2, Mic, MicOff, PhoneOff, ShieldCheck, Video, VideoOff } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { VoiceNotes } from "@/components/visit/VoiceNotes";
import { cn } from "@/lib/utils";

type Bootstrap = {
  role: "doctor" | "patient";
  room: string;
  ice_servers: RTCIceServer[];
  consultation_id: string | null;
  consent: { doctor: boolean | null; patient: boolean | null };
  appointment: { id: string; date: string; time: string; status: string; symptoms: string | null; triage_summary: string | null };
  me: string;
  other: string;
};

type Signal =
  | { t: "hello"; from: string }
  | { t: "sdp"; from: string; sid: string; description: RTCSessionDescriptionInit }
  | { t: "ice"; from: string; sid: string; candidate: RTCIceCandidateInit }
  | { t: "consent"; from: string; consents: boolean }
  | { t: "bye"; from: string }
  | { t: "note"; from: string };

type Phase = "lobby" | "joining" | "in_call" | "ended";

function recorderMime(): string {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting for the other person to join…",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Connection unstable — reconnecting…",
  failed: "Couldn't connect. Your network may block direct calls — try another network or send a voice message below.",
};

export default function VisitRoomPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [status, setStatus] = useState("waiting");
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [myConsent, setMyConsent] = useState(true);
  const [consent, setConsent] = useState<{ doctor: boolean | null; patient: boolean | null }>({ doctor: null, patient: null });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [endResult, setEndResult] = useState<{ transcript?: string | null; prescription_id?: string | null; error?: string; recorded?: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [noteSignal, setNoteSignal] = useState(0);

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sidRef = useRef<string>("");
  const channelRef = useRef<RealtimeChannel | null>(null);
  // MediaStream doesn't exist during SSR; created on mount.
  const localStream = useRef<MediaStream>(null as unknown as MediaStream);
  const remoteStream = useRef<MediaStream>(null as unknown as MediaStream);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const connectedAt = useRef<number | null>(null);
  const myId = useRef(Math.random().toString(36).slice(2));
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (!localStream.current) localStream.current = new MediaStream();
    if (!remoteStream.current) remoteStream.current = new MediaStream();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace(`/login?next=${encodeURIComponent(`/visit/${appointmentId}`)}`);
      else setSession(data.session);
    });
  }, [router, appointmentId]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/visit/${appointmentId}`, { headers: { authorization: `Bearer ${session.access_token}` } })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not open this visit.");
        setBoot(d);
        setConsent(d.consent);
      })
      .catch((e) => setError(e.message));
  }, [session, appointmentId]);

  useEffect(() => {
    if (phase !== "in_call") return;
    const t = setInterval(() => connectedAt.current && setElapsed(Math.round((Date.now() - connectedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const send = useCallback((msg: Record<string, unknown>) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload: { ...msg, from: myId.current } });
  }, []);

  // ---- Peer connection ----------------------------------------------------
  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const audio = localStream.current.getAudioTracks()[0] || null;
    const video = localStream.current.getVideoTracks()[0] || null;
    for (const tr of pc.getTransceivers()) {
      const kind = tr.receiver.track?.kind;
      tr.direction = "sendrecv";
      tr.sender.replaceTrack(kind === "audio" ? audio : video).catch(() => undefined);
    }
  }, []);

  const newPeer = useCallback(
    (sid: string, iceServers: RTCIceServer[], isOfferer: boolean) => {
      pcRef.current?.close();
      remoteStream.current = new MediaStream();
      if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream.current;
      pendingIce.current = [];
      sidRef.current = sid;
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      pc.onicecandidate = (e) => e.candidate && send({ t: "ice", sid, candidate: e.candidate.toJSON() });
      pc.ontrack = (e) => {
        if (!remoteStream.current.getTracks().includes(e.track)) remoteStream.current.addTrack(e.track);
        if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream.current;
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") {
          setStatus("connected");
          if (!connectedAt.current) connectedAt.current = Date.now();
        } else if (s === "disconnected") setStatus("reconnecting");
        else if (s === "failed") setStatus("failed");
        else if (s === "connecting" || s === "new") setStatus("connecting");
      };
      if (isOfferer) {
        // Fixed audio+video transceivers so toggling video never needs renegotiation.
        pc.addTransceiver("audio", { direction: "sendrecv" });
        pc.addTransceiver("video", { direction: "sendrecv" });
        attachLocalTracks(pc);
        pc.createOffer()
          .then((o) => pc.setLocalDescription(o))
          .then(() => send({ t: "sdp", sid, description: pc.localDescription!.toJSON() }));
      }
      setStatus("connecting");
      return pc;
    },
    [attachLocalTracks, send]
  );

  const onSignal = useCallback(
    async (msg: Signal) => {
      if (!boot || msg.from === myId.current) return;
      const isDoctor = boot.role === "doctor";
      if (msg.t === "hello") {
        // Doctor always offers (fresh session); patient answers a doctor's hello with its own.
        if (isDoctor) newPeer(Math.random().toString(36).slice(2), boot.ice_servers, true);
        else send({ t: "hello" });
        return;
      }
      if (msg.t === "consent") {
        setConsent((c) => ({ ...c, [isDoctor ? "patient" : "doctor"]: msg.consents }));
        return;
      }
      if (msg.t === "note") return setNoteSignal((n) => n + 1);
      if (msg.t === "bye") {
        setStatus("waiting");
        pcRef.current?.close();
        pcRef.current = null;
        remoteStream.current = new MediaStream();
        if (remoteVideo.current) remoteVideo.current.srcObject = null;
        return;
      }
      if (msg.t === "sdp") {
        if (msg.description.type === "offer" && !isDoctor) {
          const pc = newPeer(msg.sid, boot.ice_servers, false);
          await pc.setRemoteDescription(msg.description);
          attachLocalTracks(pc);
          await pc.setLocalDescription(await pc.createAnswer());
          send({ t: "sdp", sid: msg.sid, description: pc.localDescription!.toJSON() });
          for (const c of pendingIce.current.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
        } else if (msg.description.type === "answer" && isDoctor && msg.sid === sidRef.current && pcRef.current) {
          await pcRef.current.setRemoteDescription(msg.description);
          for (const c of pendingIce.current.splice(0)) await pcRef.current.addIceCandidate(c).catch(() => undefined);
        }
        return;
      }
      if (msg.t === "ice") {
        const pc = pcRef.current;
        if (!pc || msg.sid !== sidRef.current || !pc.remoteDescription) {
          if (msg.sid === sidRef.current || !isDoctor) pendingIce.current.push(msg.candidate);
          return;
        }
        await pc.addIceCandidate(msg.candidate).catch(() => undefined);
      }
    },
    [boot, newPeer, attachLocalTracks, send]
  );

  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  async function join(withVideo: boolean) {
    if (!boot || !session) return;
    setPhase("joining");
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: withVideo ? { width: 640, height: 480 } : false });
      localStream.current = media;
      setVideoOn(withVideo);
      if (localVideo.current) localVideo.current.srcObject = media;
    } catch {
      setPhase("lobby");
      setError("Please allow microphone (and camera) access to join the visit.");
      return;
    }
    const res = await fetch(`/api/visit/${appointmentId}/consent`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ consents: myConsent }),
    });
    const d = await res.json().catch(() => ({}));
    if (d.consent) setConsent(d.consent);

    supabase.realtime.setAuth(session.access_token);
    const ch = supabase.channel(`visit-${boot.room}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "signal" }, ({ payload }) => onSignalRef.current(payload as Signal));
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        send({ t: "hello" });
        send({ t: "consent", consents: myConsent });
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setError("Lost the connection to the visit server. Refresh to retry.");
    });
    channelRef.current = ch;
    setPhase("in_call");
  }

  // Doctor's browser records the mixed conversation once both parties consented.
  useEffect(() => {
    if (!boot || boot.role !== "doctor" || phase !== "in_call" || status !== "connected") return;
    if (!consent.doctor || !consent.patient || recorderRef.current) return;
    const remoteAudio = remoteStream.current.getAudioTracks();
    if (!remoteAudio.length) return;
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(new MediaStream(localStream.current.getAudioTracks())).connect(dest);
    ctx.createMediaStreamSource(new MediaStream(remoteAudio)).connect(dest);
    const mime = recorderMime();
    const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.start(1000);
    recorderRef.current = rec;
    audioCtxRef.current = ctx;
    setRecording(true);
  }, [boot, phase, status, consent]);

  function teardown() {
    send({ t: "bye" });
    pcRef.current?.close();
    pcRef.current = null;
    localStream.current?.getTracks().forEach((t) => t.stop());
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }

  useEffect(() => () => teardown(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function endCall() {
    if (!session || !boot) return;
    const duration = connectedAt.current ? Math.round((Date.now() - connectedAt.current) / 1000) : 0;
    let blob: Blob | null = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      });
      blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
    }
    recorderRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    setRecording(false);
    teardown();
    setPhase("ended");
    if (boot.role !== "doctor") return;
    setUploading(true);
    const form = new FormData();
    if (blob && blob.size) form.append("audio", blob, "visit.webm");
    form.append("duration_seconds", String(duration));
    const res = await fetch(`/api/visit/${appointmentId}/recording`, { method: "POST", headers: { authorization: `Bearer ${session.access_token}` }, body: form });
    const d = await res.json().catch(() => ({}));
    setUploading(false);
    setEndResult(res.ok ? d : { error: d.error || "Could not save the recording." });
  }

  async function toggleVideo() {
    const pc = pcRef.current;
    const videoSender = pc?.getTransceivers().find((t) => t.receiver.track?.kind === "video")?.sender;
    if (videoOn) {
      localStream.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStream.current.removeTrack(t);
      });
      await videoSender?.replaceTrack(null);
      setVideoOn(false);
    } else {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const track = cam.getVideoTracks()[0];
        localStream.current.addTrack(track);
        await videoSender?.replaceTrack(track);
        if (localVideo.current) localVideo.current.srcObject = localStream.current;
        setVideoOn(true);
      } catch {
        setError("Camera permission denied.");
      }
    }
  }

  function toggleMute() {
    localStream.current.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  }

  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const backHref = boot?.role === "doctor" ? "/doctor/dashboard" : "/my-care";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex items-center justify-between">
        <OstrixLogo size="sm" withWordmark />
        <Link href={backHref} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
      {!boot && !error && <Loader2 className="h-5 w-5 animate-spin text-text-muted" />}

      {boot && (
        <>
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary">Video visit with {boot.other}</h1>
            <p className="text-xs text-text-muted">
              {boot.appointment.date} · {boot.appointment.time.slice(0, 5)} · in-app, end-to-end encrypted (WebRTC)
            </p>
          </div>

          {boot.role === "doctor" && (boot.appointment.triage_summary || boot.appointment.symptoms) && (
            <div className="rounded-lg border border-border bg-bg-surface p-3 text-xs text-text-secondary">
              {boot.appointment.triage_summary && <p><b>AI triage:</b> {String(boot.appointment.triage_summary)}</p>}
              {boot.appointment.symptoms && <p><b>Patient said:</b> {boot.appointment.symptoms}</p>}
            </div>
          )}

          {phase === "lobby" || phase === "joining" ? (
            <div data-testid="visit-lobby" className="flex flex-col gap-3 rounded-xl border border-border bg-bg-surface p-4">
              <label className="flex items-start gap-2 text-sm text-text-primary">
                <input data-testid="visit-consent" type="checkbox" checked={myConsent} onChange={(e) => setMyConsent(e.target.checked)} className="mt-1" />
                <span>
                  I agree this visit&apos;s audio may be recorded and transcribed so the doctor gets an AI-drafted prescription to review. The recording is stored privately
                  and only saved if both doctor and patient agree.
                </span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button data-testid="join-video" onClick={() => join(true)} disabled={phase === "joining"} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-black disabled:opacity-50">
                  {phase === "joining" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Join with video
                </button>
                <button data-testid="join-audio" onClick={() => join(false)} disabled={phase === "joining"} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-accent px-4 text-sm font-medium text-accent disabled:opacity-50">
                  <Mic className="h-4 w-4" /> Audio only
                </button>
              </div>
              <p className="text-[11px] text-text-muted">Works in Chrome, Safari and Edge on phone or computer. No app or account needed. In an emergency call 1122.</p>
            </div>
          ) : null}

          <div className={cn("flex flex-col gap-3", phase === "in_call" ? "" : "hidden")}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                data-testid="visit-status"
                data-status={status}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium",
                  status === "connected" ? "bg-green-500/10 text-green-700" : status === "failed" ? "bg-red-500/10 text-red-600" : "bg-yellow-500/10 text-yellow-700"
                )}
              >
                {STATUS_LABEL[status] || status}
              </span>
              {status === "connected" && <span className="text-text-muted">{mm}</span>}
              {recording || (boot.role === "patient" && status === "connected" && consent.doctor && consent.patient) ? (
                <span data-testid="visit-recording" className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 font-medium text-red-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> Recording
                </span>
              ) : (
                <span className="flex items-center gap-1 text-text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {consent.doctor && consent.patient ? "Recording starts when connected" : "Not recording (needs both consents)"}
                </span>
              )}
            </div>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-neutral-900 sm:aspect-video">
              <video ref={remoteVideo} data-testid="remote-video" autoPlay playsInline className="h-full w-full object-cover" />
              {status !== "connected" && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/80">{STATUS_LABEL[status]}</div>
              )}
              <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">{boot.other}</div>
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className={cn("absolute bottom-3 right-3 w-24 rounded-lg border border-white/30 bg-neutral-800 object-cover sm:w-40", videoOn ? "" : "hidden")}
              />
            </div>
            <div className="flex items-center justify-center gap-3">
              <button data-testid="toggle-mute" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className={cn("flex h-12 w-12 items-center justify-center rounded-full border", muted ? "border-red-500 bg-red-500/10 text-red-600" : "border-border bg-bg-surface text-text-primary")}>
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button data-testid="toggle-video" onClick={toggleVideo} aria-label={videoOn ? "Turn camera off" : "Turn camera on"} className={cn("flex h-12 w-12 items-center justify-center rounded-full border", !videoOn ? "border-border bg-bg-elevated text-text-secondary" : "border-border bg-bg-surface text-text-primary")}>
                {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
              <button data-testid="end-call" onClick={endCall} aria-label="End call" className="flex h-12 items-center gap-2 rounded-full bg-red-600 px-5 text-sm font-medium text-white">
                <PhoneOff className="h-5 w-5" /> End
              </button>
            </div>
          </div>

          {phase === "ended" && (
            <div data-testid="visit-ended" className="flex flex-col gap-2 rounded-xl border border-border bg-bg-surface p-4 text-sm">
              <p className="font-medium text-text-primary">Visit ended.</p>
              {boot.role === "doctor" ? (
                uploading ? (
                  <p className="flex items-center gap-2 text-text-secondary"><Loader2 className="h-4 w-4 animate-spin" /> Uploading the recording, transcribing and drafting the prescription with Grok…</p>
                ) : endResult?.error && !endResult.transcript ? (
                  <p className="text-red-600">{endResult.error}</p>
                ) : endResult?.recorded ? (
                  <>
                    <p data-testid="visit-transcript" className="text-xs text-text-secondary">Transcript: {endResult.transcript ? `“${endResult.transcript.slice(0, 600)}”` : "(empty)"}</p>
                    {endResult.prescription_id ? (
                      <p data-testid="visit-draft-ready" className="text-text-primary">
                        ✅ Grok prescription draft is ready. <Link className="font-medium text-accent" href="/doctor/dashboard">Review &amp; sign on your dashboard →</Link>
                      </p>
                    ) : (
                      <p className="text-red-600">{endResult.error || "No draft was created."}</p>
                    )}
                  </>
                ) : (
                  <p className="text-text-secondary">No recording was saved (consent not given or call never connected). You can still use “Start visit” on the dashboard to write notes and draft a prescription.</p>
                )
              ) : (
                <p className="text-text-secondary">Your doctor will review and sign your prescription. It will appear in <Link href="/my-care" className="text-accent">My care</Link>.</p>
              )}
            </div>
          )}

          {session && <VoiceNotes appointmentId={appointmentId} accessToken={session.access_token} refreshSignal={noteSignal} onSent={() => send({ t: "note" })} />}
        </>
      )}
    </div>
  );
}
