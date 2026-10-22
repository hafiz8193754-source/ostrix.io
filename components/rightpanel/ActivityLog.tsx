"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Circle, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StepDef, ProgressContext, DetailEntry } from "@/lib/progressSteps";
import type { GenerationStatus } from "@/types";

interface ActivityLogProps {
  status: GenerationStatus;
  stepDefs: StepDef[];
  ctx?: ProgressContext;
  resultSummary?: { files: number; lines: number } | null;
  idleMessage?: string;
}

function resolveDetail(entry: DetailEntry, ctx: ProgressContext): string {
  return typeof entry === "function" ? entry(ctx) : entry;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ActivityLog({ status, stepDefs, ctx = {}, resultSummary, idleMessage }: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // First time each step's status changes, stamp it — gives the log real
  // timestamps without adding timestamp-tracking to the shared progress hook.
  const timestampsRef = useRef<Record<string, number>>({});
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (status.steps.length > 0 && startRef.current === null) startRef.current = Date.now();
    if (status.steps.length === 0) {
      startRef.current = null;
      timestampsRef.current = {};
    }
    status.steps.forEach((step) => {
      const key = `${step.id}:${step.status}`;
      if (!timestampsRef.current[key]) timestampsRef.current[key] = Date.now();
    });
  }, [status.steps]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [status.steps, status.currentDetail]);

  if (status.steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-text-muted">
        {idleMessage || "No activity yet. Generate a website to see Ostrix work in real time."}
      </div>
    );
  }

  const showSummary = !status.isActive && !status.failed && resultSummary;

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-border bg-bg-surface px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
        Activity
      </div>

      <div className="flex flex-col py-2">
        {startRef.current && (
          <LogRow time={formatTime(startRef.current)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} text="Session started" />
        )}

        {status.steps.map((step) => {
          const def = stepDefs.find((d) => d.id === step.id);
          const startedAt = timestampsRef.current[`${step.id}:active`];
          const completedAt = timestampsRef.current[`${step.id}:completed`] || timestampsRef.current[`${step.id}:failed`];
          const time = completedAt ? formatTime(completedAt) : startedAt ? formatTime(startedAt) : "";

          return (
            <div key={step.id}>
              <LogRow
                time={time}
                active={step.status === "active"}
                icon={
                  step.status === "pending" ? (
                    <Circle className="h-4 w-4 text-text-muted opacity-40" />
                  ) : step.status === "active" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  ) : step.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )
                }
                text={`${step.label}${step.status === "active" ? "…" : ""}`}
                duration={step.status === "completed" && step.duration !== undefined ? `${step.duration}s` : undefined}
              />
              {step.status === "active" && def && (
                <div className="pb-1">
                  {def.details.map((d, i) => (
                    <div key={i} className="py-0.5 pl-[62px] pr-4 font-mono-code text-[11.5px] text-text-muted before:mr-1.5 before:text-border before:content-['├──']">
                      {resolveDetail(d, ctx)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {status.failed && (
          <LogRow time="" icon={<XCircle className="h-4 w-4 text-red-500" />} text={status.errorMessage || "Generation failed"} />
        )}
      </div>

      {showSummary && resultSummary && (
        <div className="mx-4 mb-4 rounded-lg border border-border bg-bg-elevated p-3.5 text-xs text-text-secondary">
          <p className="mb-2 border-b border-border pb-1.5 font-medium uppercase tracking-wide text-text-muted">Summary</p>
          <p>Total time: {status.elapsedSeconds}s</p>
          <p>Files generated: {resultSummary.files}</p>
          <p>Total lines: {resultSummary.lines}</p>
        </div>
      )}
    </div>
  );
}

function LogRow({
  time,
  icon,
  text,
  duration,
  active,
}: {
  time: string;
  icon: ReactNode;
  text: string;
  duration?: string;
  active?: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-2.5 px-4 py-1", active && "border-l-[3px] border-accent bg-accent-glow pl-[13px]")}>
      <span className="w-14 shrink-0 pt-0.5 font-mono-code text-[10.5px] text-text-muted opacity-60">{time}</span>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="flex-1 text-xs text-text-secondary">{text}</span>
      {duration && <span className="shrink-0 font-mono-code text-[11px] text-text-muted opacity-70">{duration}</span>}
    </div>
  );
}
