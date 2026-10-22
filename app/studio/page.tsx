"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/layout/TopNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { DoctorHealthAssistant } from "@/components/doctor/DoctorHealthAssistant";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { applyTheme, watchSystemTheme } from "@/lib/theme";
import type { ChatMessage, Profile, Session } from "@/types";

function truncate(text: string, max = 60) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export default function Studio() {
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null | undefined>(undefined);
  const [doctorMsgs, setDoctorMsgs] = useState<ChatMessage[]>([]);
  const [doctorLive, setDoctorLive] = useState(true);
  const [doctorResetKey, setDoctorResetKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarInitialized = useRef(false);

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
      const next = window.innerWidth >= 1200;
      if (!sidebarInitialized.current) {
        sidebarInitialized.current = true;
        setSidebarOpen(next);
      }
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [doctorMsgs]);

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

  useEffect(() => {
    if (!profile) return;
    applyTheme(profile.settings.theme);
    return watchSystemTheme(profile.settings.theme, () => applyTheme(profile.settings.theme));
  }, [profile]);

  async function ensureSession(title: string): Promise<string | null> {
    if (activeSessionId) return activeSessionId;
    try {
      const created = await api("/api/sessions", { agent: "doctor", title: truncate(title) });
      setActiveSessionId(created.session.id);
      setSessions((s) => [created.session, ...s]);
      return created.session.id as string;
    } catch {
      return null;
    }
  }

  function newChat() {
    setDoctorMsgs([]);
    setDoctorLive(true);
    setDoctorResetKey((k) => k + 1);
    setActiveSessionId(null);
  }

  async function selectSession(id: string) {
    if (!session) return;
    setActiveSessionId(id);
    setDoctorLive(false);
    const res = await fetch(`/api/sessions/${id}/messages`, { headers: { authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) return;
    const data = await res.json();
    setDoctorMsgs((data.messages || []).filter((m: ChatMessage) => m && (m.role === "user" || m.role === "agent") && "text" in m));
  }

  async function renameSessionHandler(id: string, title: string) {
    if (!session) return;
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ title }),
    });
    if (res.ok) setSessions((list) => list.map((s) => (s.id === id ? { ...s, title } : s)));
  }

  async function deleteSessionHandler(id: string) {
    if (!session) return;
    const res = await fetch(`/api/sessions/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    setSessions((list) => list.filter((s) => s.id !== id));
    if (activeSessionId === id) newChat();
  }

  if (session === undefined) return null;

  return (
    <div className="flex h-screen flex-col bg-bg-base">
      <TopNav onToggleSidebar={() => setSidebarOpen((o) => !o)} accessToken={session?.access_token} />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          sessions={sessions}
          activeSessionId={activeSessionId}
          userEmail={session?.user.email || ""}
          displayName={profile?.display_name || session?.user.user_metadata?.display_name}
          avatarUrl={profile?.avatar_url}
          onNewChat={newChat}
          onSelectSession={selectSession}
          onRenameSession={renameSessionHandler}
          onDeleteSession={deleteSessionHandler}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          {doctorLive ? (
            <div className="flex flex-1 flex-col overflow-y-auto p-6 sm:p-8">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                <DoctorHealthAssistant
                  key={doctorResetKey}
                  api={api}
                  accessToken={session?.access_token || ""}
                  sessionId={activeSessionId}
                  onSymptomsSubmitted={(text) => {
                    const userMsg: ChatMessage = { role: "user", text };
                    setDoctorMsgs((m) => [...m, userMsg]);
                    ensureSession(text).then((sid) => persistMessage(sid, userMsg));
                  }}
                  onResult={(resultMsg) => {
                    setDoctorMsgs((m) => [...m, resultMsg]);
                    persistMessage(activeSessionId, resultMsg);
                  }}
                />
              </div>
            </div>
          ) : (
            <div ref={scrollRef} className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 sm:p-8">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                {doctorMsgs.length === 0 && <p className="pt-8 text-center text-sm text-text-muted">No messages in this visit.</p>}
                {doctorMsgs.map((m, i) =>
                  m.role === "user" ? (
                    <MessageBubble key={i} role="user" text={m.text} />
                  ) : "text" in m ? (
                    <MessageBubble key={i} role="agent" text={m.text} />
                  ) : null
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      {session && (
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          accessToken={session.access_token}
          userEmail={session.user.email || ""}
          profile={profile}
          onProfileUpdated={setProfile}
        />
      )}
    </div>
  );
}
