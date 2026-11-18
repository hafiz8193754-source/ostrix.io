"use client";

import { useState } from "react";
import { cnicError, countryDialLabel, isPakistan, phoneError } from "@/lib/countries";
import { fieldClass, inputClass, type StepProps } from "./types";
import { StepFooter } from "./StepFooter";

export function StepAccount({ values, onChange, onNext }: StepProps) {
  const [touched, setTouched] = useState(false);

  const pakistan = isPakistan(values.country);
  const cnicMessage = cnicError(values.country, values.cnic);
  const phoneMessage = phoneError(values.country, values.phone);
  const cnicValid = !cnicMessage;
  const phoneValid = !phoneMessage;
  const dial = countryDialLabel(values.country);
  const emailValid = /^\S+@\S+\.\S+$/.test(values.email.trim());
  const nameValid = values.full_name.trim().length >= 3;
  const canContinue = nameValid && cnicValid && emailValid && phoneValid;

  function handleNext() {
    setTouched(true);
    if (canContinue) onNext();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-surface p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-text-primary">Account &amp; Identity</h2>
        <p className="text-xs text-text-muted">As printed on your medical registration — this is what patients and admins will see.</p>
      </div>

      <label className={fieldClass}>
        Full name
        <input
          value={values.full_name}
          onChange={(e) => onChange({ full_name: e.target.value })}
          placeholder="Dr. Ahmad Raza"
          className={inputClass}
        />
        {touched && !nameValid && <span className="text-xs text-red-500">Enter at least 3 characters.</span>}
      </label>

      <label className={fieldClass}>
        {pakistan ? "CNIC" : "National ID (optional)"}
        <input
          value={values.cnic}
          onChange={(e) => onChange({ cnic: e.target.value })}
          placeholder={pakistan ? "12345-1234567-1" : "As printed on your ID"}
          className={inputClass}
        />
        {touched && !cnicValid && <span className="text-xs text-red-500">{cnicMessage}</span>}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={fieldClass}>
          Email
          <input
            type="email"
            value={values.email}
            onChange={(e) => onChange({ email: e.target.value })}
            className={inputClass}
          />
          {touched && !emailValid && <span className="text-xs text-red-500">Enter a valid email.</span>}
        </label>
        <label className={fieldClass}>
          Mobile
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-10 shrink-0 items-center rounded-lg border border-border bg-bg-base px-2 text-sm text-text-secondary">{dial || "+"}</span>
            <input
              value={values.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
              placeholder={pakistan ? "0300-1234567" : "Phone number"}
              inputMode="tel"
              autoComplete="tel"
              className={`${inputClass} min-w-0 flex-1 text-base`}
            />
          </span>
          {touched && !phoneValid && <span className="text-xs text-red-500">{phoneMessage}</span>}
        </label>
      </div>

      <div className={fieldClass}>
        <span className="flex items-center justify-between">
          WhatsApp
          <label className="flex items-center gap-1.5 text-xs font-normal text-text-secondary">
            <input
              type="checkbox"
              checked={values.whatsappSame}
              onChange={(e) => onChange({ whatsappSame: e.target.checked, whatsapp: e.target.checked ? "" : values.whatsapp })}
              className="accent-accent"
            />
            Same as mobile
          </label>
        </span>
        {!values.whatsappSame && (
          <input
            value={values.whatsapp}
            onChange={(e) => onChange({ whatsapp: e.target.value })}
            placeholder={pakistan ? "0300-1234567" : "WhatsApp number"}
            className={inputClass}
          />
        )}
      </div>

      <StepFooter onNext={handleNext} canContinue nextLabel="Continue" />
    </div>
  );
}
