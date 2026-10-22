import { Loader2 } from "lucide-react";

interface StepFooterProps {
  onBack?: () => void;
  onNext: () => void;
  canContinue: boolean;
  nextLabel?: string;
  loading?: boolean;
}

export function StepFooter({ onBack, onNext, canContinue, nextLabel = "Continue", loading }: StepFooterProps) {
  return (
    <div className="flex items-center gap-2 pt-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={!canContinue || loading}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} {nextLabel}
      </button>
    </div>
  );
}
