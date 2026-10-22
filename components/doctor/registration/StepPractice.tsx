"use client";

import { useState } from "react";
import { CITIES, fieldClass, inputClass, type StepProps } from "./types";
import { StepFooter } from "./StepFooter";

export function StepPractice({ values, onChange, onNext, onBack }: StepProps) {
  const [touched, setTouched] = useState(false);

  const clinicValid = values.clinic_name.trim().length > 0;
  const addressValid = values.clinic_address.trim().length > 0;
  const cityValid = values.city !== "Other" || values.cityOther.trim().length > 0;
  const feeNum = parseInt(values.consultation_fee_pkr, 10);
  const feeValid = Number.isFinite(feeNum) && feeNum >= 0 && feeNum <= 100000;
  const typeValid = values.accepts_online || values.accepts_walk_in;

  const canContinue = clinicValid && addressValid && cityValid && feeValid && typeValid;

  function handleNext() {
    setTouched(true);
    if (canContinue) onNext();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-text-primary">Practice Details</h2>
      </div>

      <label className={fieldClass}>
        Clinic / hospital name
        <input value={values.clinic_name} onChange={(e) => onChange({ clinic_name: e.target.value })} className={inputClass} />
        {touched && !clinicValid && <span className="text-xs text-red-500">Clinic/hospital name is required.</span>}
      </label>

      <label className={fieldClass}>
        Full address
        <input value={values.clinic_address} onChange={(e) => onChange({ clinic_address: e.target.value })} className={inputClass} />
        {touched && !addressValid && <span className="text-xs text-red-500">Address is required.</span>}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={fieldClass}>
          City
          <select value={values.city} onChange={(e) => onChange({ city: e.target.value })} className={inputClass}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {values.city === "Other" && (
          <label className={fieldClass}>
            Specify city
            <input value={values.cityOther} onChange={(e) => onChange({ cityOther: e.target.value })} className={inputClass} />
            {touched && !cityValid && <span className="text-xs text-red-500">Enter your city.</span>}
          </label>
        )}
      </div>

      <div className="flex gap-4 text-sm text-text-secondary">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={values.accepts_walk_in}
            onChange={(e) => onChange({ accepts_walk_in: e.target.checked })}
            className="accent-accent"
          />
          In-person (walk-in)
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={values.accepts_online}
            onChange={(e) => onChange({ accepts_online: e.target.checked })}
            className="accent-accent"
          />
          Online consultation
        </label>
      </div>
      {touched && !typeValid && <span className="text-xs text-red-500">Offer at least one consultation type.</span>}

      <div className="grid grid-cols-2 gap-4">
        <label className={fieldClass}>
          Consultation fee (PKR)
          <input
            value={values.consultation_fee_pkr}
            onChange={(e) => onChange({ consultation_fee_pkr: e.target.value })}
            inputMode="numeric"
            className={inputClass}
          />
          {touched && !feeValid && <span className="text-xs text-red-500">Enter an amount between 0 and 100,000.</span>}
        </label>
        <label className={fieldClass}>
          Max appointments per day
          <input
            value={values.max_daily_appointments}
            onChange={(e) => onChange({ max_daily_appointments: e.target.value })}
            inputMode="numeric"
            className={inputClass}
          />
        </label>
      </div>

      <label className={fieldClass}>
        Short bio (shown on your public profile)
        <textarea
          value={values.bio}
          onChange={(e) => onChange({ bio: e.target.value.slice(0, 500) })}
          rows={3}
          className="resize-none rounded-lg border border-border bg-bg-elevated px-3 py-2 text-text-primary outline-none focus-visible:border-accent"
        />
        <span className="self-end text-[11px] text-text-muted">{values.bio.length}/500</span>
      </label>

      <StepFooter onBack={onBack} onNext={handleNext} canContinue nextLabel="Continue" />
    </div>
  );
}
