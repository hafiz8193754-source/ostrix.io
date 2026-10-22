import { VERIFICATION_CHECKLIST_ITEMS } from "@/lib/clinical";

interface VerificationChecklistProps {
  checked: string[];
  onToggle: (key: string) => void;
}

export function VerificationChecklist({ checked, onToggle }: VerificationChecklistProps) {
  return (
    <div className="flex flex-col gap-2">
      {VERIFICATION_CHECKLIST_ITEMS.map((item) => (
        <label key={item.key} className="flex items-start gap-2.5 rounded-lg border border-border bg-bg-elevated p-2.5 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={checked.includes(item.key)}
            onChange={() => onToggle(item.key)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}
