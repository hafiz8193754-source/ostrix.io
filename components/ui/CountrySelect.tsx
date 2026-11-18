"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { filterCountries, normalizeCountry } from "@/lib/countries";
import { cn } from "@/lib/utils";

type CountrySelectProps = {
  value: string;
  onChange: (name: string) => void;
  id?: string;
  className?: string;
};

/**
 * Searchable country field. A native <select> of 249 names is painful on a phone;
 * this opens a filterable list with 44px rows and a 16px input so iOS does not zoom.
 */
export function CountrySelect({ value, onChange, id, className }: CountrySelectProps) {
  const reactId = useId();
  const listId = `${reactId}-list`;
  const inputId = id ?? `${reactId}-input`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = normalizeCountry(value);
  const label = selected?.name ?? (value.trim() || "Choose a country");
  const matches = useMemo(() => filterCountries(query), [query]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(name: string) {
    onChange(name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg-elevated px-3 text-left text-base text-text-primary outline-none focus-visible:border-accent"
      >
        <span className="min-w-0 truncate">{label}</span>
        <span aria-hidden className="text-xs text-text-muted">{selected ? selected.code : ""}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-xl border border-border bg-bg-surface shadow-lift">
          <label className="sr-only" htmlFor={inputId}>
            Search countries
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a country"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            className="h-11 w-full border-b border-border bg-bg-surface px-3 text-base text-text-primary outline-none placeholder:text-text-muted"
          />
          <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto overscroll-contain py-1">
            {matches.length === 0 && <li className="px-3 py-3 text-sm text-text-muted">No matching country.</li>}
            {matches.map((country) => {
              const active = selected?.code === country.code;
              return (
                <li key={country.code} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => choose(country.name)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-base",
                      active ? "bg-accent/15 text-text-primary" : "text-text-primary hover:bg-bg-elevated"
                    )}
                  >
                    <span className="min-w-0 truncate">{country.name}</span>
                    <span className="shrink-0 text-xs text-text-muted">+{country.dials[0]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
