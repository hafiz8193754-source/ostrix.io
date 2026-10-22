"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Zap, Circle, CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GenerationStatus, ProgressStep } from "@/types";

interface GenerationProgressProps {
  title: string;
  status: GenerationStatus;
  onRetry?: () => void;
  /** Shorter card for inline use (refine / deploy) rather than the full builder card. */
  compact?: boolean;
}

function StepRow({ step, compact }: { step: ProgressStep; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex items-center gap-2.5", compact ? "text-xs" : "text-[13.5px]")}
      >
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
          {step.status === "pending" && <Circle className="h-4 w-4 text-text-muted opacity-40" />}
          {step.status === "active" && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
          {step.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {step.status === "failed" && <XCircle className="h-4 w-4 text-red-500" />}
        </span>
        <span
          className={cn(
            "flex-1",
            step.status === "pending" && "text-text-muted opacity-60",
            step.status === "active" && "font-semibold text-accent",
            step.status === "completed" && "text-text-secondary",
            step.status === "failed" && "font-semibold text-red-500"
          )}
        >
          {step.label}
          {step.status === "active" && "…"}
        </span>
        {step.status === "completed" && step.duration !== undefined && (
          <span className="shrink-0 text-[11px] text-text-muted">{step.duration}s</span>
        )}
      </motion.div>

      {step.status === "active" && (
        <div className="ml-[32px] h-[3px] overflow-hidden rounded-full bg-bg-elevated">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover"
            animate={{ width: ["0%", "70%", "100%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}
    </div>
  );
}

export function GenerationProgress({ title, status, onRetry, compact }: GenerationProgressProps) {
  const totalPct = status.estimatedTotalSeconds
    ? Math.min((status.elapsedSeconds / status.estimatedTotalSeconds) * 100, status.isActive ? 95 : 100)
    : 0;

  return (
    <div
      className={cn(
        "w-full self-start overflow-hidden rounded-lg border border-border bg-bg-surface",
        compact ? "max-w-md" : "max-w-[680px]"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 bg-gradient-to-r from-accent to-accent-hover font-bold text-black",
          compact ? "px-3.5 py-2.5 text-xs" : "px-[18px] py-3.5 text-sm"
        )}
      >
        <Zap className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} fill="currentColor" />
        {title}
      </div>

      <div className={cn("flex flex-col gap-2.5", compact ? "px-3.5 py-3" : "px-[18px] py-4")}>
        {status.steps.map((step) => (
          <StepRow key={step.id} step={step} compact={compact} />
        ))}
      </div>

      {status.failed ? (
        <div className={cn("flex flex-col gap-2 border-t border-border", compact ? "mx-3.5 my-3" : "mx-[18px] my-4")}>
          <p className="text-xs text-red-500">{status.errorMessage || "Generation failed."}</p>
          {onRetry && (
            <Button size="sm" variant="outline" className="self-start" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      ) : (
        status.currentDetail && (
          <div className={cn("border border-dashed border-border bg-bg-elevated", compact ? "mx-3.5 mb-3 min-h-[32px] rounded-md px-3 py-2" : "mx-[18px] mb-4 min-h-[40px] rounded-lg px-3.5 py-2.5")}>
            <AnimatePresence mode="wait">
              <motion.p
                key={status.currentDetail}
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 0.85, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={cn("italic text-text-secondary", compact ? "text-[11.5px]" : "text-[12.5px]")}
              >
                {status.currentDetail}
              </motion.p>
            </AnimatePresence>
          </div>
        )
      )}

      {!status.failed && status.estimatedTotalSeconds > 0 && (
        <>
          <div className="flex items-center justify-between border-t border-border px-[18px] py-2.5 text-xs text-text-muted">
            <span>Estimated time: ~{status.estimatedTotalSeconds}s</span>
            <span>{status.elapsedSeconds}s elapsed</span>
          </div>
          <div className="h-[3px] w-full bg-bg-elevated">
            <motion.div
              className="h-full bg-accent"
              animate={{ width: `${totalPct}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </div>
        </>
      )}
    </div>
  );
}
