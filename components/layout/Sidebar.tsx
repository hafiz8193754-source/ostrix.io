"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus, MoreVertical, Pencil, Trash2, Check, X, Sparkles, Globe, Sprout, Stethoscope, Settings as SettingsIcon } from "lucide-react";

import { OstrixLogo } from "@/components/brand/OstrixLogo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AgentMode, Session } from "@/types";

interface SidebarProps {
  open: boolean;
  mode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  sessions: Session[];
  activeSessionId: string | null;
  userEmail: string;
  displayName?: string;
  avatarUrl?: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
}

const AGENTS: { mode: AgentMode; label: string; icon: typeof Sparkles }[] = [
  { mode: "prompt_engineer", label: "Prompt Engineer", icon: Sparkles },
  { mode: "builder", label: "Website Builder", icon: Globe },
  { mode: "farm", label: "Farming Advisor", icon: Sprout },
  { mode: "doctor", label: "Assistant Doctor", icon: Stethoscope },
];

const AGENT_META: Record<AgentMode, { icon: typeof Sparkles; label: string }> = {
  prompt_engineer: { icon: Sparkles, label: "Prompt Engineer" },
  builder: { icon: Globe, label: "Website Builder" },
  farm: { icon: Sprout, label: "Farming Advisor" },
  doctor: { icon: Stethoscope, label: "Assistant Doctor" },
};

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function groupSessions(sessions: Session[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: Session[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const s of sessions) {
    const updated = new Date(s.updated_at);
    updated.setHours(0, 0, 0, 0);
    if (updated.getTime() === today.getTime()) groups[0].items.push(s);
    else if (updated.getTime() === yesterday.getTime()) groups[1].items.push(s);
    else groups[2].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

export function Sidebar({
  open,
  mode,
  onModeChange,
  sessions,
  activeSessionId,
  userEmail,
  displayName,
  avatarUrl,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onOpenSettings,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupSessions(sessions), [sessions]);
  const name = displayName || userEmail;

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenId]);

  function startEdit(s: Session) {
    setEditingId(s.id);
    setEditValue(s.title);
    setMenuOpenId(null);
  }

  function commitEdit() {
    if (editingId && editValue.trim()) onRenameSession(editingId, editValue.trim());
    setEditingId(null);
  }

  function confirmDelete() {
    if (pendingDelete) onDeleteSession(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <motion.aside
      animate={{ width: open ? 260 : 0 }}
      initial={false}
      transition={{ type: "tween", duration: 0.2, ease: "easeInOut" }}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-bg-surface"
    >
      <div className="flex w-[260px] flex-col gap-3 p-3">
        <div className="flex items-center gap-2 px-1">
          <OstrixLogo size="sm" />
        </div>
        <Button onClick={onNewChat} className="w-full justify-center">
          <Plus className="h-4 w-4" /> New Chat
        </Button>

        {/* The only agent switcher in the app — Composer no longer has a
            mode-pill row, matching how New Chat now only lives here too. */}
        <div className="flex flex-col gap-1">
          {AGENTS.map((a) => (
            <button
              key={a.mode}
              onClick={() => onModeChange(a.mode)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                mode === a.mode ? "bg-accent-glow text-accent" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              )}
            >
              <a.icon className="h-4 w-4" /> {a.label}
            </button>
          ))}
        </div>
      </div>

      <nav className="w-[260px] flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {group.label}
            </div>
            {group.items.map((s) => {
              const AgentIcon = AGENT_META[s.agent]?.icon || Sparkles;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "group relative flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    s.id === activeSessionId ? "bg-bg-elevated text-text-primary" : "text-text-secondary hover:bg-bg-elevated"
                  )}
                >
                  {editingId === s.id ? (
                    <>
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="min-w-0 flex-1 rounded border border-accent bg-bg-base px-1.5 py-0.5 text-sm text-text-primary outline-none"
                      />
                      <button onClick={commitEdit} className="shrink-0 text-text-secondary hover:text-accent" aria-label="Save">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="shrink-0 text-text-secondary hover:text-text-primary" aria-label="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <AgentIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-label={AGENT_META[s.agent]?.label} />
                      <button onClick={() => onSelectSession(s.id)} className="min-w-0 flex-1 truncate text-left">
                        {s.title}
                      </button>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}
                        className="hidden shrink-0 text-text-secondary hover:text-text-primary group-hover:block"
                        aria-label="Session options"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>

                      {menuOpenId === s.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-lg border border-border bg-bg-surface shadow-lg"
                        >
                          <button
                            onClick={() => startEdit(s)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Rename
                          </button>
                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              setPendingDelete(s);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/5"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-text-muted">No conversations yet.</p>
        )}
      </nav>

      <div className="flex w-[260px] flex-col border-t border-border">
        <div className="flex items-center gap-2 p-3">
          <Avatar className="h-8 w-8">
            {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" /> : <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>}
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{name}</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <SettingsIcon className="h-4 w-4" /> Settings
        </button>
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              "{pendingDelete?.title}" and its full message history will be permanently deleted. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.aside>
  );
}
