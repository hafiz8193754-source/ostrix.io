"use client";

import { useState } from "react";
import { fieldClass, inputClass, LANGUAGES, SPECIALIZATIONS, type StepProps } from "./types";
import { StepFooter } from "./StepFooter";
import { cn } from "@/lib/utils";

const PMDC_RE = /^\d{5,7}(-[A-Za-z])?$/;
const CURRENT_YEAR = new Date().getFullYear();

export function StepCredentials({ values, onChange, onNext, onBack }: StepProps) {
  const [touched, setTouched] = useState(false);

  const pmdcValid = PMDC_RE.test(values.pmdc_number.trim());
  const expiryValid = !!values.pmdc_expiry_date && new Date(values.pmdc_expiry_date) > new Date();
  const gradYear = parseInt(values.year_of_graduation, 10);
  const gradValid = Number.isFinite(gradYear) && gradYear >= 1960 && gradYear <= CURRENT_YEAR;
  const expYears = parseInt(values.experience_years, 10);
  const expValid = Number.isFinite(expYears) && expYears >= 0 && expYears <= 60;
  const expInconsistent = gradValid && expValid && CURRENT_YEAR - gradYear < expYears;
  const qualificationsValid = values.qualifications.trim().length > 0;
  const typeValid = !!values.pmdc_registration_type;

  const canContinue = pmdcValid && expiryValid && gradValid && expValid && qualificationsValid && typeValid;

  function toggleLanguage(lang: string) {
    onChange({
      languages: values.languages.includes(lang) ? values.languages.filter((l) => l !== lang) : [...values.languages, lang],
    });
  }

  function handleNext() {
    setTouched(true);
    if (canContinue) onNext();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-text-primary">Professional Credentials</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={fieldClass}>
          PMDC registration number
          <input
            value={values.pmdc_number}
            onChange={(e) => onChange({ pmdc_number: e.target.value })}
            placeholder="12345-P"
            className={inputClass}
          />
          <span className="text-[11px] text-text-muted">As printed on your PMDC certificate.</span>
          {touched && !pmdcValid && <span className="text-xs text-red-500">PMDC number should look like 12345-P or 123456.</span>}
        </label>
        <label className={fieldClass}>
          PMDC registration type
          <select
            value={values.pmdc_registration_type}
            onChange={(e) => onChange({ pmdc_registration_type: e.target.value as StepProps["values"]["pmdc_registration_type"] })}
            className={inputClass}
          >
            <option value="">Select…</option>
            <option value="provisional">Provisional</option>
            <option value="full">Full</option>
            <option value="specialist">Specialist</option>
          </select>
          {touched && !typeValid && <span className="text-xs text-red-500">Select a registration type.</span>}
        </label>
      </div>

      <label className={fieldClass}>
        PMDC expiry date
        <input
          type="date"
          value={values.pmdc_expiry_date}
          onChange={(e) => onChange({ pmdc_expiry_date: e.target.value })}
          className={inputClass}
        />
        {touched && !expiryValid && <span className="text-xs text-red-500">Pick a future expiry date.</span>}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={fieldClass}>
          Primary specialization
          <select value={values.specialization} onChange={(e) => onChange({ specialization: e.target.value })} className={inputClass}>
            {SPECIALIZATIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClass}>
          Sub-specialization (optional)
          <input
            value={values.sub_specialization}
            onChange={(e) => onChange({ sub_specialization: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      <label className={fieldClass}>
        Qualifications
        <input
          value={values.qualifications}
          onChange={(e) => onChange({ qualifications: e.target.value })}
          placeholder="MBBS, FCPS (Medicine)"
          className={inputClass}
        />
        {touched && !qualificationsValid && <span className="text-xs text-red-500">Qualifications are required.</span>}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={fieldClass}>
          Year of graduation
          <input
            value={values.year_of_graduation}
            onChange={(e) => onChange({ year_of_graduation: e.target.value })}
            inputMode="numeric"
            className={inputClass}
          />
          {touched && !gradValid && <span className="text-xs text-red-500">Enter a year between 1960 and {CURRENT_YEAR}.</span>}
        </label>
        <label className={fieldClass}>
          Years of experience
          <input
            value={values.experience_years}
            onChange={(e) => onChange({ experience_years: e.target.value })}
            inputMode="numeric"
            className={inputClass}
          />
          {touched && !expValid && <span className="text-xs text-red-500">Enter a number between 0 and 60.</span>}
        </label>
      </div>
      {expInconsistent && (
        <p className="text-xs text-amber-600">
          That's more years of experience than years since graduation — double-check these numbers.
        </p>
      )}

      <div>
        <p className="mb-1.5 text-sm text-text-primary">Languages spoken</p>
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => toggleLanguage(lang)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                values.languages.includes(lang) ? "border-accent bg-accent-glow text-accent" : "border-border bg-bg-elevated text-text-secondary"
              )}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={handleNext} canContinue nextLabel="Continue" />
    </div>
  );
}
