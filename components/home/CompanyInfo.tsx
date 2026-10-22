import { companyFields, isPlaceholder } from "@/lib/company";

// Renders only the company fields that have real values; renders nothing if all are empty.
export function CompanyInfo({ className = "" }: { className?: string }) {
  const fields = companyFields();
  if (fields.length === 0) return null;
  return (
    <dl className={`grid gap-1 text-xs text-text-muted ${className}`}>
      {fields.map((f) => (
        <div key={f.label} className="flex flex-wrap gap-x-1.5">
          <dt className="font-medium text-text-secondary">{f.label}:</dt>
          <dd>{f.href ? <a href={f.href} className="hover:text-accent">{f.value}</a> : f.value}</dd>
        </div>
      ))}
      {isPlaceholder && <p className="mt-1 italic">Sample details, to be replaced with the registered company information.</p>}
    </dl>
  );
}
