import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Account", "Credentials", "Practice", "Documents", "Schedule", "Declarations"];

export function RegistrationProgressBar({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "active" : "upcoming";
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                  state === "done" && "bg-accent text-accent-fg",
                  state === "active" && "border-2 border-accent text-accent",
                  state === "upcoming" && "border border-border text-text-muted"
                )}
              >
                {state === "done" ? <Check className="h-3 w-3" /> : n}
              </div>
              <span className={cn("hidden text-[10px] sm:block", state === "upcoming" ? "text-text-muted" : "text-text-secondary")}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${(Math.min(step, STEP_LABELS.length) / STEP_LABELS.length) * 100}%` }}
        />
      </div>
      <p className="text-xs text-text-muted">
        Step {step} of {STEP_LABELS.length}
      </p>
    </div>
  );
}
