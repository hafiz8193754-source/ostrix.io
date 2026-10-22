"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { readPhoto, readFileAsBase64 } from "@/lib/image";
import { downloadSiteZip } from "@/lib/exportZip";
import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { TopNav } from "@/components/layout/TopNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { EmptyState } from "@/components/chat/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer, type AttachmentMode } from "@/components/chat/Composer";
import { AttachmentBar } from "@/components/promptEngineer/AttachmentBar";
import { WebsiteQuestionnaire } from "@/components/WebsiteQuestionnaire";
import { DoctorHealthAssistant } from "@/components/doctor/DoctorHealthAssistant";
import { RightPanel } from "@/components/RightPanel";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { GenerationProgress } from "@/components/GenerationProgress";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { useSSEChat } from "@/hooks/useSSEChat";
import { useBuilderStream, type BuilderDonePayload, type RefineDonePayload } from "@/hooks/useBuilderStream";
import type { CodeTypingState } from "@/hooks/useCodeTyping";
import { BUILDER_STEPS, type ProgressContext } from "@/lib/progressSteps";
import { friendlyFileLabel } from "@/lib/streamingProject";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import { FarmAdvisor } from "@/components/farm/FarmAdvisor";
import { FarmPlanCard } from "@/components/farm/FarmPlanCard";
import type {
  AgentMode,
  ChatMessage,
  DeployResult,
  FarmMeta,
  FarmPlan,
  GenerationStatus,
  PendingFileAttachment,
  ProgressStep,
  Profile,
  ScreenshotAnalysis,
  Session,
  Site,
  SiteFile,
} from "@/types";

type Viewport = "mobile" | "tablet" | "desktop";
type RunKind = "builder" | "screenshot";

const RUN_TITLES: Record<RunKind, string> = {
  builder: "Ostrix is building your site",
  screenshot: "Ostrix is rebuilding your site",
};

interface Screenshot {
  data: string;
  type: string;
  preview: string;
}

function truncate(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function Studio() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const [mode, setMode] = useState<AgentMode>("builder");
  const [builderMsgs, setBuilderMsgs] = useState<ChatMessage[]>([]);
  const [farmMsgs, setFarmMsgs] = useState<ChatMessage[]>([]);
  const [farmLive, setFarmLive] = useState(true);
  const [farmResetKey, setFarmResetKey] = useState(0);
  const [doctorMsgs, setDoctorMsgs] = useState<ChatMessage[]>([]);
  const [doctorLive, setDoctorLive] = useState(true);
  const [doctorResetKey, setDoctorResetKey] = useState(0);
  const [promptEngineerMsgs, setPromptEngineerMsgs] = useState<ChatMessage[]>([]);
  const [peAttachments, setPeAttachments] = useState<PendingFileAttachment[]>([]);
  const [peUrl, setPeUrl] = useState("");
  const [peAttachError, setPeAttachError] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  const [restartingIndex, setRestartingIndex] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [attachmentMode, setAttachmentMode] = useState<AttachmentMode>("reference");
  const [questionnaireSkipped, setQuestionnaireSkipped] = useState(false);
  const [activeRun, setActiveRun] = useState<RunKind | null>(null);
  const [generationCtx, setGenerationCtx] = useState<ProgressContext>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const retryRef = useRef<(() => void) | null>(null);

  // Builder's real, event-driven generation state — fed by actual SSE events
  // from /api/builder(/screenshot), not a simulated timer. streamingFiles
  // grows live as the model writes; builderSteps mirrors it as a real
  // Activity-tab trail (one entry per file, no fake canned steps).
  const [streamingFiles, setStreamingFiles] = useState<SiteFile[]>([]);
  const [builderPhase, setBuilderPhase] = useState("");
  const [builderSteps, setBuilderSteps] = useState<ProgressStep[]>([]);
  const [builderFailed, setBuilderFailed] = useState(false);
  const [builderErrorMessage, setBuilderErrorMessage] = useState<string | null>(null);
  const builderStream = useBuilderStream<BuilderDonePayload>({ url: "/api/builder", accessToken: session?.access_token || "" });
  const screenshotStream = useBuilderStream<BuilderDonePayload>({ url: "/api/builder/screenshot", accessToken: session?.access_token || "" });
  const refineStream = useBuilderStream<RefineDonePayload>({ url: "/api/builder/refine", accessToken: session?.access_token || "" });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<Record<AgentMode, string | null>>({
    prompt_engineer: null,
    builder: null,
    farm: null,
    doctor: null,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarInitialized = useRef(false);

  const promptEngineerChat = useSSEChat({ url: "/api/agents/prompt-engineer", accessToken: session?.access_token || "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) router.replace("/login");
      else setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      const next: Viewport = w < 768 ? "mobile" : w < 1200 ? "tablet" : "desktop";
      setViewport(next);
      if (!sidebarInitialized.current) {
        sidebarInitialized.current = true;
        setSidebarOpen(next === "desktop");
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [builderMsgs, farmMsgs, doctorMsgs, promptEngineerMsgs, loading]);

  const api = useCallback(
    async (path: string, body: unknown) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      return data;
    },
    [session]
  );

  // Fire-and-forget: the live chat should never stall on a persistence hiccup.
  const persistMessage = useCallback(
    async (sessionId: string | null, message: ChatMessage) => {
      if (!sessionId || !session) return;
      try {
        await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ role: message.role, content: message }),
        });
      } catch {
        // best-effort
      }
    },
    [session]
  );

  const loadSessions = useCallback(async () => {
    if (!session) return;
    const res = await fetch("/api/sessions", { headers: { authorization: `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions || []);
    }
  }, [session]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/profile", { headers: { authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((d) => setProfile(d.profile || null))
      .catch(() => {});
  }, [session]);

  // Applies the signed-in user's saved theme preference and keeps it synced
  // with the OS while the preference is "system".
  useEffect(() => {
    if (!profile) return;
    applyTheme(profile.settings.theme);
    return watchSystemTheme(profile.settings.theme, () => applyTheme(profile.settings.theme));
  }, [profile]);

  async function ensureSession(agent: AgentMode, title: string): Promise<string | null> {
    if (activeSessionId[agent]) return activeSessionId[agent];
    try {
      const created = await api("/api/sessions", { agent, title: truncate(title) });
      setActiveSessionId((s) => ({ ...s, [agent]: created.session.id }));
      setSessions((s) => [created.session, ...s]);
      return created.session.id as string;
    } catch {
      return null;
    }
  }

  // Aborts any in-flight generation — used whenever the user navigates away
  // from a build that's still running or has failed, so a stale progress
  // card never leaks into a different thread. (Farm/Doctor's live components
  // own their own generation state and remount via their reset keys instead.)
  function abortActiveRun() {
    if (loading) {
      resetBuilderStreamState();
      setLoading(false);
      setActiveRun(null);
    }
  }

  function resetBuilderStreamState() {
    setStreamingFiles([]);
    setBuilderPhase("");
    setBuilderSteps([]);
    setBuilderFailed(false);
    setBuilderErrorMessage(null);
  }

  // Shared SSE-event handlers for the two live-generation flows (fresh build,
  // screenshot rebuild) — both grow the same streamingFiles/builderSteps state
  // in real time as the model actually writes, no simulated timer involved.
  function trackBuilderStreamEvents() {
    return {
      onStatus: (message: string) => setBuilderPhase(message),
      onFileStart: (path: string) => {
        setStreamingFiles((f) => [...f, { path, content: "" }]);
        setBuilderSteps((s) => [...s, { id: path, label: friendlyFileLabel(path), status: "active" as const }]);
      },
      onFileDelta: (path: string, chunk: string) => {
        setStreamingFiles((f) => f.map((x) => (x.path === path ? { ...x, content: x.content + chunk } : x)));
      },
      onFileDone: (path: string, content: string) => {
        setStreamingFiles((f) => f.map((x) => (x.path === path ? { ...x, content } : x)));
        setBuilderSteps((s) => s.map((step) => (step.id === path ? { ...step, status: "completed" as const } : step)));
      },
    };
  }

  function switchMode(next: AgentMode) {
    // `loading` only ever tracks an in-flight Builder/screenshot generation
    // now — Farm/Doctor's live components own their own generation state.
    if (loading && next !== "builder") abortActiveRun();
    setMode(next);
    setRightPanelOpen(false);
  }

  function newChat() {
    abortActiveRun();
    if (mode === "builder") {
      setBuilderMsgs([]);
      setScreenshot(null);
      setAttachmentMode("reference");
      setQuestionnaireSkipped(false);
    } else if (mode === "farm") {
      setFarmMsgs([]);
      setFarmLive(true);
      setFarmResetKey((k) => k + 1);
    } else if (mode === "doctor") {
      setDoctorMsgs([]);
      setDoctorLive(true);
      setDoctorResetKey((k) => k + 1);
    } else {
      setPromptEngineerMsgs([]);
      setPeAttachments([]);
      setPeUrl("");
      setPeAttachError("");
    }
    setActiveSessionId((s) => ({ ...s, [mode]: null }));
    setPreviewIndex(null);
    setRightPanelOpen(false);
    if (viewport !== "desktop") setSidebarOpen(false);
  }

  // Reopening a sidebar session now hydrates the actual thread (not just the
  // title) from the messages table, and restores the split-view preview to
  // the last generated site if there was one. Doctor sessions hydrate as a
  // read-only transcript — DoctorHealthAssistant has no resume-mid-flow
  // capability, so a reopened session shows its history rather than a live UI.
  async function selectSession(id: string) {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    abortActiveRun();
    setMode(target.agent);
    setActiveSessionId((s) => ({ ...s, [target.agent]: id }));
    setPreviewIndex(null);
    setRightPanelOpen(false);
    if (viewport !== "desktop") setSidebarOpen(false);

    try {
      const res = await fetch(`/api/sessions/${id}/messages`, {
        headers: { authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const msgs: ChatMessage[] = data.messages || [];

      if (target.agent === "builder") {
        setBuilderMsgs(msgs);
        let lastSiteIdx: number | null = null;
        msgs.forEach((m, i) => {
          if ("site" in m) lastSiteIdx = i;
        });
        setPreviewIndex(lastSiteIdx);
        setQuestionnaireSkipped(msgs.length > 0);
        setRightPanelOpen(lastSiteIdx !== null);
      } else if (target.agent === "farm") {
        setFarmMsgs(msgs);
        setFarmLive(false);
        setRightPanelOpen(msgs.some((m) => "plan" in m));
      } else if (target.agent === "doctor") {
        setDoctorMsgs(msgs);
        setDoctorLive(false);
      } else {
        setPromptEngineerMsgs(msgs);
      }
    } catch {
      // best-effort — leave whatever local state exists if hydration fails
    }
  }

  async function renameSessionHandler(id: string, title: string) {
    setSessions((s) => s.map((x) => (x.id === id ? { ...x, title } : x)));
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ title }),
      });
    } catch {
      // best-effort
    }
  }

  async function deleteSessionHandler(id: string) {
    setSessions((s) => s.filter((x) => x.id !== id));
    setActiveSessionId((s) => {
      const next = { ...s };
      (Object.keys(next) as AgentMode[]).forEach((k) => {
        if (next[k] === id) next[k] = null;
      });
      return next;
    });
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${session?.access_token}` },
      });
    } catch {
      // best-effort
    }
  }

  async function runBuild(brief: string) {
    if (!brief || loading) return;
    retryRef.current = () => runBuild(brief);
    setInput("");
    const userMsg: ChatMessage = { role: "user", text: brief };
    setBuilderMsgs((m) => [...m, userMsg]);
    setLoading(true);
    setActiveRun("builder");
    setGenerationCtx({ brief });
    resetBuilderStreamState();
    setRightPanelOpen(true);

    const sid = await ensureSession("builder", brief);
    persistMessage(sid, userMsg);

    const attached = screenshot ? { data: screenshot.data, type: screenshot.type } : undefined;
    setScreenshot(null);

    await builderStream.generate(
      { brief, screenshot: attached },
      {
        ...trackBuilderStreamEvents(),
        onDone: (result) => {
          const agentMsg: ChatMessage = {
            role: "agent",
            site: result.site,
            deployed: null,
            sandboxPreviewUrl: result.sandboxPreviewUrl ?? null,
            consoleError: result.sandboxErrors?.length ? result.sandboxErrors.join("\n") : null,
            sandboxLogs: result.sandboxLogs || [],
          };
          setBuilderMsgs((m) => {
            const next = [...m, agentMsg];
            setPreviewIndex(next.length - 1);
            return next;
          });
          persistMessage(sid, agentMsg);
          setLoading(false);
          setActiveRun(null);
        },
        // Inline failure lives in the progress card itself (failed step +
        // error + Try again) — no error bubble pushed to history; loading
        // stays true so the card keeps showing until the user retries or
        // navigates away.
        onError: (message) => {
          setBuilderFailed(true);
          setBuilderErrorMessage(message);
        },
      }
    );
  }

  // Phase 7: rebuild an existing website from a screenshot (analyze → rebuild
  // pipeline), distinct from "reference image" mode which just augments a
  // normal text brief.
  async function runScreenshotBuild(additionalBrief: string) {
    if (!screenshot || loading) return;
    const capturedScreenshot = screenshot;
    retryRef.current = () => {
      setScreenshot(capturedScreenshot);
      runScreenshotBuild(additionalBrief);
    };
    setInput("");
    const userMsg: ChatMessage = { role: "user", text: additionalBrief || "Rebuild this website", photo: screenshot.preview };
    setBuilderMsgs((m) => [...m, userMsg]);
    setLoading(true);
    setActiveRun("screenshot");
    setGenerationCtx({ brief: additionalBrief });
    resetBuilderStreamState();
    setRightPanelOpen(true);

    const sid = await ensureSession("builder", additionalBrief || "Rebuilt from screenshot");
    persistMessage(sid, userMsg);

    const attached = { data: capturedScreenshot.data, type: capturedScreenshot.type };
    setScreenshot(null);

    await screenshotStream.generate(
      { screenshot: attached, additionalBrief },
      {
        ...trackBuilderStreamEvents(),
        onDone: (result) => {
          const agentMsg: ChatMessage = {
            role: "agent",
            site: result.site,
            deployed: null,
            source: "screenshot",
            analysis: result.analysis as ScreenshotAnalysis,
            sandboxPreviewUrl: result.sandboxPreviewUrl ?? null,
            consoleError: result.sandboxErrors?.length ? result.sandboxErrors.join("\n") : null,
            sandboxLogs: result.sandboxLogs || [],
          };
          setBuilderMsgs((m) => {
            const next = [...m, agentMsg];
            setPreviewIndex(next.length - 1);
            return next;
          });
          persistMessage(sid, agentMsg);
          setLoading(false);
          setActiveRun(null);
        },
        onError: (message) => {
          setBuilderFailed(true);
          setBuilderErrorMessage(message);
        },
      }
    );
  }

  async function handleBuild() {
    if (attachmentMode === "screenshot" && screenshot) {
      await runScreenshotBuild(input.trim());
      return;
    }
    await runBuild(input.trim());
  }

  // Streaming Prompt Engineer send — the one SSE-driven agent this round.
  // Appends a placeholder assistant message and grows its text in place as
  // "token" events arrive, matching the growing-bubble pattern the shell asks for.
  // Can send with empty text as long as a file or reference URL is queued.
  async function runPromptEngineerMessage(text: string) {
    if ((!text && peAttachments.length === 0 && !peUrl.trim()) || promptEngineerChat.isStreaming) return;
    setInput("");
    const attachmentsSnapshot = peAttachments;
    const urlSnapshot = peUrl.trim();
    setPeAttachments([]);
    setPeUrl("");
    setPeAttachError("");

    const userMsg: ChatMessage = {
      role: "user",
      text: text || (urlSnapshot ? `Take a look at ${urlSnapshot}` : "(attached files)"),
      ...(attachmentsSnapshot.length
        ? { attachments: attachmentsSnapshot.map((a) => ({ kind: a.kind, name: a.name, preview: a.preview })) }
        : {}),
      ...(urlSnapshot ? { sourceUrl: urlSnapshot } : {}),
    };
    const history = promptEngineerMsgs
      .filter((m): m is Extract<ChatMessage, { role: "user" | "agent"; text: string }> => (m.role === "user" || m.role === "agent") && "text" in m)
      .slice(-16)
      .map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", text: m.text }));

    setPromptEngineerMsgs((m) => [...m, userMsg, { role: "agent", text: "" }]);
    const sid = await ensureSession("prompt_engineer", text || urlSnapshot || "New brief");
    persistMessage(sid, userMsg);

    function replaceLastAgentText(text: string) {
      setPromptEngineerMsgs((m) => {
        const next = [...m];
        next[next.length - 1] = { role: "agent", text };
        return next;
      });
    }

    // Accumulate locally rather than reading promptEngineerChat.streamingText
    // inside the callback — that reference is captured once when send() is
    // called and won't reflect the hook's own re-renders as tokens arrive.
    let accumulated = "";
    await promptEngineerChat.send(
      {
        message: text,
        history,
        attachments: attachmentsSnapshot.map((a) => ({ kind: a.kind, mediaType: a.mediaType, data: a.data, name: a.name })),
        url: urlSnapshot || undefined,
      },
      {
        onToken: (chunk) => {
          accumulated += chunk;
          replaceLastAgentText(accumulated);
        },
        onDone: (fullText) => {
          replaceLastAgentText(fullText);
          persistMessage(sid, { role: "agent", text: fullText });
        },
        onError: (message) => replaceLastAgentText(`Sorry — ${message}`),
      }
    );
  }

  const PE_MAX_ATTACHMENTS = 6;
  const PE_MAX_PDF_BYTES = 20 * 1024 * 1024;

  async function handlePeFilesSelected(files: FileList) {
    setPeAttachError("");
    const room = PE_MAX_ATTACHMENTS - peAttachments.length;
    if (room <= 0) {
      setPeAttachError(`You can attach up to ${PE_MAX_ATTACHMENTS} files.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    const next: PendingFileAttachment[] = [];
    for (const file of picked) {
      try {
        if (file.type === "application/pdf") {
          if (file.size > PE_MAX_PDF_BYTES) {
            setPeAttachError(`"${file.name}" is too large — keep PDFs under 20MB.`);
            continue;
          }
          const data = await readFileAsBase64(file);
          next.push({ kind: "pdf", mediaType: "application/pdf", data, name: file.name });
        } else if (file.type.startsWith("image/")) {
          const resized = await readPhoto(file, 1600);
          next.push({ kind: "image", mediaType: resized.type, data: resized.data, name: file.name, preview: resized.preview });
        }
      } catch {
        setPeAttachError(`Could not read "${file.name}".`);
      }
    }
    if (next.length) setPeAttachments((a) => [...a, ...next].slice(0, PE_MAX_ATTACHMENTS));
  }

  function removePeAttachment(index: number) {
    setPeAttachments((a) => a.filter((_, i) => i !== index));
  }

  async function handleSend() {
    if (mode === "prompt_engineer") {
      await runPromptEngineerMessage(input.trim());
      return;
    }
    await handleBuild();
  }

  async function handleAttach(file: File) {
    try {
      const resized = await readPhoto(file, 1200);
      setScreenshot({ data: resized.data, type: resized.type, preview: resized.preview });
    } catch {
      // attachment is optional — ignore a failed resize
    }
  }

  function handleRemoveAttachment() {
    setScreenshot(null);
  }

  async function deploySite(idx: number) {
    const msg = builderMsgs[idx];
    if (!("site" in msg)) return;
    setBuilderMsgs((m) => m.map((x, i) => (i === idx && "site" in x ? { ...x, deployed: "pending", deployError: null } : x)));
    try {
      const result: DeployResult = await api("/api/deploy", { name: msg.site.name, files: msg.site.files });
      setBuilderMsgs((m) => m.map((x, i) => (i === idx && "site" in x ? { ...x, deployed: result } : x)));
    } catch (e) {
      setBuilderMsgs((m) =>
        m.map((x, i) => (i === idx && "site" in x ? { ...x, deployed: null, deployError: (e as Error).message } : x))
      );
    }
  }

  // Conversational editing: appends a new (refined) site message rather than
  // mutating history in place, so the message-persistence log stays append-only.
  async function handleRefine(idx: number, changeRequest: string) {
    const msg = builderMsgs[idx];
    if (!("site" in msg)) return;
    const prev = builderMsgs[idx - 1];
    const originalBrief = prev && prev.role === "user" ? prev.text : msg.site.name;

    setRefiningIndex(idx);
    try {
      // Streams under the hood (same transport as a fresh build), but the
      // refine card in RightPanel just awaits the final merged file set —
      // refine only ever touches a handful of files, so a live per-file
      // reveal isn't worth a second live-typing wiring path here.
      const files = await new Promise<SiteFile[]>((resolve, reject) => {
        refineStream.generate(
          { originalBrief, siteName: msg.site.name, currentFiles: msg.site.files, changeRequest },
          { onDone: (result) => resolve(result.files), onError: (message) => reject(new Error(message)) }
        );
      });
      const refinedSite: Site = { ...msg.site, files };
      const refinedMsg: ChatMessage = {
        role: "agent",
        site: refinedSite,
        deployed: null,
        refinedCount: (msg.refinedCount || 0) + 1,
        // The previous sandbox served the pre-refine files — clear it rather
        // than show a live preview that no longer matches the displayed code.
        // "Restart sandbox" spins up a fresh one for the refined files.
        sandboxPreviewUrl: null,
        consoleError: null,
      };
      setBuilderMsgs((m) => {
        const next = [...m, refinedMsg];
        setPreviewIndex(next.length - 1);
        return next;
      });
      persistMessage(activeSessionId.builder, refinedMsg);
    } catch {
      // leave the current preview as-is on failure
    }
    setRefiningIndex(null);
  }

  async function handleRestartSandbox(idx: number) {
    const msg = builderMsgs[idx];
    if (!("site" in msg)) return;
    setRestartingIndex(idx);
    try {
      const result = await api("/api/sandbox/restart", { files: msg.site.files });
      setBuilderMsgs((m) =>
        m.map((x, i) =>
          i === idx && "site" in x
            ? {
                ...x,
                sandboxPreviewUrl: result.previewUrl ?? null,
                consoleError: result.errors?.length ? result.errors.join("\n") : null,
                sandboxLogs: result.logs || [],
              }
            : x
        )
      );
    } catch {
      // leave existing preview state on failure
    }
    setRestartingIndex(null);
  }

  function handleSuggestion(suggestedMode: AgentMode, prefill?: string, autoSubmit?: boolean) {
    switchMode(suggestedMode);
    if (suggestedMode !== "builder" || !prefill) return;
    if (autoSubmit) runBuild(prefill);
    else setInput(prefill);
  }

  if (session === undefined) return null;

  const msgs = mode === "builder" ? builderMsgs : mode === "farm" ? farmMsgs : mode === "doctor" ? doctorMsgs : promptEngineerMsgs;
  const previewSite =
    previewIndex !== null && builderMsgs[previewIndex] && "site" in builderMsgs[previewIndex]
      ? (builderMsgs[previewIndex] as Extract<ChatMessage, { site: unknown }>)
      : null;
  const latestPlanMsg = [...farmMsgs].reverse().find((m): m is Extract<ChatMessage, { plan: FarmPlan }> => "plan" in m);
  const rightPanelLayout = viewport === "desktop" ? "inline" : "overlay";
  // `loading`/`activeRun` only ever track Builder/screenshot now — Farm and
  // Doctor's live components own their own generation state internally.
  const generationActive = loading && activeRun !== null && mode === "builder";
  const generationStepDefs = BUILDER_STEPS;
  const hasRightPanelContent = mode === "builder" ? !!previewSite : mode === "farm" ? !!latestPlanMsg : false;

  // Real generation status for Builder/screenshot — built from actual SSE
  // events (streamingFiles/builderSteps/builderPhase), not a simulated timer.
  const isBuilderStreaming = (activeRun === "builder" || activeRun === "screenshot") && loading;
  const builderStatus: GenerationStatus = {
    isActive: isBuilderStreaming,
    steps: builderSteps,
    currentDetail: builderPhase,
    elapsedSeconds: 0,
    estimatedTotalSeconds: 0,
    failed: builderFailed,
    errorMessage: builderErrorMessage,
  };
  const lastStreamingFile = streamingFiles[streamingFiles.length - 1];
  const liveSite: Site | null = isBuilderStreaming && streamingFiles.length > 0 ? { name: "", summary: "", files: streamingFiles } : null;
  const liveTyping: CodeTypingState | null =
    isBuilderStreaming && lastStreamingFile
      ? { currentFileIndex: streamingFiles.length - 1, visibleLines: lastStreamingFile.content === "" ? 0 : lastStreamingFile.content.split("\n").length, isActive: true }
      : null;
  // Doctor/Prompt Engineer render the normal thread when not live — Doctor's
  // fresh state is its live health assistant, Prompt Engineer's is a
  // centered greeting (peFresh). Farm's fresh state is its own live advisor
  // (mode === "farm" && farmLive, handled above, not this branch at all).
  const showQuestionnaire = mode === "builder" && builderMsgs.length === 0 && !questionnaireSkipped;
  const showEmpty = mode === "builder" && builderMsgs.length === 0 && questionnaireSkipped;
  const peFresh = mode === "prompt_engineer" && promptEngineerMsgs.length === 0;

  return (
    <div className="flex h-screen flex-col bg-bg-base">
      <TopNav mode={mode} onToggleSidebar={() => setSidebarOpen((o) => !o)} accessToken={session?.access_token} />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          mode={mode}
          onModeChange={switchMode}
          sessions={sessions}
          activeSessionId={activeSessionId[mode]}
          userEmail={session?.user.email || ""}
          displayName={profile?.display_name || session?.user.user_metadata?.display_name}
          avatarUrl={profile?.avatar_url}
          onNewChat={newChat}
          onSelectSession={selectSession}
          onRenameSession={renameSessionHandler}
          onDeleteSession={deleteSessionHandler}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="flex min-w-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            {showQuestionnaire ? (
              <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-8">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                  <WebsiteQuestionnaire
                    onComplete={(brief, shot) => {
                      if (shot) setScreenshot({ data: shot.data, type: shot.type, preview: `data:${shot.type};base64,${shot.data}` });
                      runBuild(brief);
                    }}
                    onSkip={() => setQuestionnaireSkipped(true)}
                  />
                </div>
              </div>
            ) : showEmpty ? (
              <EmptyState
                onSelectSuggestion={handleSuggestion}
                mode={mode}
                value={input}
                onChange={setInput}
                onSend={handleSend}
                loading={loading}
                screenshotPreview={screenshot?.preview ?? null}
                onAttach={handleAttach}
                onRemoveAttachment={handleRemoveAttachment}
                attachmentMode={attachmentMode}
                onAttachmentModeChange={setAttachmentMode}
              />
            ) : mode === "farm" && farmLive ? (
              <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-8">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                  <FarmAdvisor
                    key={farmResetKey}
                    accessToken={session?.access_token || ""}
                    onIntakeSubmitted={(text) => {
                      const userMsg: ChatMessage = { role: "user", text };
                      setFarmMsgs((m) => [...m, userMsg]);
                      setRightPanelOpen(true);
                      ensureSession("farm", text).then((sid) => persistMessage(sid, userMsg));
                    }}
                    onResult={(resultMsg) => {
                      setFarmMsgs((m) => [...m, resultMsg]);
                      persistMessage(activeSessionId.farm, resultMsg);
                    }}
                  />
                </div>
              </div>
            ) : mode === "doctor" && doctorLive ? (
              <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-8">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                  <DoctorHealthAssistant
                    key={doctorResetKey}
                    api={api}
                    accessToken={session?.access_token || ""}
                    sessionId={activeSessionId.doctor}
                    onSymptomsSubmitted={(text) => {
                      const userMsg: ChatMessage = { role: "user", text };
                      setDoctorMsgs((m) => [...m, userMsg]);
                      ensureSession("doctor", text).then((sid) => persistMessage(sid, userMsg));
                    }}
                    onResult={(resultMsg) => {
                      setDoctorMsgs((m) => [...m, resultMsg]);
                      persistMessage(activeSessionId.doctor, resultMsg);
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <div ref={scrollRef} className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 sm:p-8">
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                    {peFresh && (
                      <div className="flex flex-col items-center gap-2 pb-3 pt-8 text-center">
                        <OstrixLogo size="lg" />
                        <h1 className="font-display text-xl font-bold text-text-primary">Prompt Engineer</h1>
                        <p className="text-sm text-text-secondary">
                          Tell me about your business — I'll interview you and hand you a complete brief to paste into the Website Builder.
                        </p>
                      </div>
                    )}
                    {mode === "doctor" && !doctorLive && doctorMsgs.length === 0 && (
                      <p className="pt-8 text-center text-sm text-text-muted">No messages in this conversation.</p>
                    )}
                    {mode === "farm" && !farmLive && farmMsgs.length === 0 && (
                      <p className="pt-8 text-center text-sm text-text-muted">No messages in this conversation.</p>
                    )}
                    {msgs.map((m, i) => {
                      if (m.role === "user")
                        return <MessageBubble key={i} role="user" text={m.text} photo={m.photo} attachments={m.attachments} sourceUrl={m.sourceUrl} />;
                      if ("site" in m)
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.2 }}
                            className="flex flex-col gap-3"
                          >
                            <div className="flex flex-col gap-2 self-start rounded-xl border border-border bg-bg-surface px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-text-primary">{m.site.name}</p>
                                {m.source === "screenshot" && (
                                  <span className="rounded-full bg-accent-glow px-2 py-0.5 text-[11px] font-medium text-accent">
                                    🔄 Rebuilt from screenshot
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted">{m.site.summary} · {m.site.files.length} files</p>
                              <button
                                onClick={() => setPreviewIndex(i)}
                                className="self-start text-xs font-medium text-accent hover:text-accent-hover"
                              >
                                {previewIndex === i ? "Viewing in preview →" : "View project →"}
                              </button>
                            </div>
                            {m.source === "screenshot" && m.analysis && <AnalysisPanel analysis={m.analysis} />}
                          </motion.div>
                        );
                      if ("plan" in m) return <FarmPlanCard key={i} plan={m.plan} meta={m.meta} />;
                      return <MessageBubble key={i} role="agent" text={m.text} />;
                    })}
                    {loading && activeRun && mode === "builder" && (
                      <GenerationProgress
                        title={RUN_TITLES[activeRun]}
                        status={builderStatus}
                        onRetry={() => {
                          setBuilderFailed(false);
                          setBuilderErrorMessage(null);
                          retryRef.current?.();
                        }}
                      />
                    )}
                    {mode === "prompt_engineer" && promptEngineerChat.isStreaming && promptEngineerChat.status && !promptEngineerChat.streamingText && (
                      <div className="flex items-center gap-2 self-start rounded-xl border border-border bg-bg-surface px-4 py-3 text-sm text-text-secondary">
                        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" /> {promptEngineerChat.status}
                      </div>
                    )}
                  </div>
                </div>

                {mode === "prompt_engineer" && (
                  <AttachmentBar
                    attachments={peAttachments}
                    url={peUrl}
                    error={peAttachError}
                    onFilesSelected={handlePeFilesSelected}
                    onRemoveAttachment={removePeAttachment}
                    onUrlChange={setPeUrl}
                    onRemoveUrl={() => setPeUrl("")}
                    disabled={promptEngineerChat.isStreaming}
                  />
                )}

                {mode !== "doctor" && (
                  <Composer
                    variant="dock"
                    mode={mode}
                    value={input}
                    onChange={setInput}
                    onSend={handleSend}
                    loading={loading || (mode === "prompt_engineer" && promptEngineerChat.isStreaming)}
                    screenshotPreview={mode === "builder" ? screenshot?.preview ?? null : null}
                    onAttach={mode === "builder" ? handleAttach : undefined}
                    onRemoveAttachment={handleRemoveAttachment}
                    attachmentMode={attachmentMode}
                    onAttachmentModeChange={setAttachmentMode}
                    hasPendingContent={mode === "prompt_engineer" && (peAttachments.length > 0 || !!peUrl.trim())}
                  />
                )}
              </>
            )}
          </main>

          <RightPanel
            mode={mode}
            layout={rightPanelLayout}
            fullScreen={viewport === "mobile"}
            open={rightPanelOpen}
            onClose={() => setRightPanelOpen(false)}
            site={liveSite ?? previewSite?.site ?? null}
            deployed={liveSite ? null : previewSite?.deployed ?? null}
            deployError={liveSite ? null : previewSite?.deployError ?? null}
            consoleError={liveSite ? null : previewSite?.consoleError ?? null}
            sandboxPreviewUrl={liveSite ? null : previewSite?.sandboxPreviewUrl ?? null}
            refinedCount={liveSite ? undefined : previewSite?.refinedCount}
            onDeploy={() => previewIndex !== null && deploySite(previewIndex)}
            onDownload={() => previewSite && downloadSiteZip(previewSite.site.name, previewSite.site.files)}
            onRefine={(text) => {
              if (previewIndex !== null) handleRefine(previewIndex, text);
            }}
            onRestartSandbox={() => {
              if (previewIndex !== null) handleRestartSandbox(previewIndex);
            }}
            refining={refiningIndex !== null && refiningIndex === previewIndex}
            restarting={restartingIndex !== null && restartingIndex === previewIndex}
            plan={latestPlanMsg?.plan ?? null}
            planMeta={latestPlanMsg?.meta ?? null}
            generationActive={generationActive}
            generationStatus={builderStatus}
            generationStepDefs={generationStepDefs}
            generationCtx={generationCtx}
            liveTyping={liveTyping}
          />
        </div>
      </div>

      {!rightPanelOpen && (rightPanelLayout === "overlay" || hasRightPanelContent) && (
        <button
          onClick={() => setRightPanelOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-elevated text-text-secondary shadow-lg hover:text-text-primary"
          aria-label="Open preview panel"
        >
          {generationActive && <span className="absolute right-2 top-2 h-2 w-2 animate-pulse-dot rounded-full bg-accent" />}
          <OstrixLogo size="xs" />
        </button>
      )}

      {session && (
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          accessToken={session.access_token}
          userEmail={session.user.email || ""}
          profile={profile}
          onProfileUpdated={(p) => setProfile(p)}
        />
      )}
    </div>
  );
}
