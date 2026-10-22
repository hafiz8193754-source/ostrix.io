// AI-calling helpers shared across doctor API routes — kept separate from
// lib/clinical.ts (pure DB access) and out of individual route.ts files
// (which should only export HTTP handlers) so summary/prescription generation
// logic isn't duplicated or cross-imported between route modules.
import type { SupabaseClient } from "@supabase/supabase-js";

import { complete, extractJson } from "@/lib/ai";
import { saveVisitSummary, logClinicalAudit } from "@/lib/clinical";
import type { PrescriptionData } from "@/types";

const SUMMARY_SYSTEM = `You are a medical documentation assistant. Based on the doctor's notes from a patient consultation, generate a structured visit summary. This is for the DOCTOR's records — it is not sent to the patient without doctor review.

Return ONLY valid JSON:
{
  "chief_complaint": "one sentence",
  "history_of_present_illness": "paragraph",
  "examination_findings": "what the doctor noted",
  "assessment": "doctor's clinical assessment",
  "plan": ["treatment plan items"],
  "medications_discussed": [{ "name": "...", "purpose": "..." }],
  "follow_up": "when and why",
  "red_flags_discussed": ["warning signs told to patient"]
}`;

export async function generateVisitSummary(db: SupabaseClient, consultationId: string, doctorNotes: string): Promise<unknown> {
  const raw = await complete({ system: SUMMARY_SYSTEM, content: doctorNotes, maxTokens: 1200 });
  const summary = extractJson(raw);
  await saveVisitSummary(db, consultationId, JSON.stringify(summary));
  await logClinicalAudit(db, consultationId, null, "ai", "visit_summary_generated", {});
  return summary;
}

const PRESCRIPTION_SYSTEM = `You are a clinical pharmacology assistant helping a Pakistani doctor draft a prescription. Based on the patient's intake, the call transcript (if available), the consultation summary, and the doctor's notes, generate a prescription draft.

CRITICAL RULES:
- Use drug names available in Pakistan (Pakistani brand names in parentheses where helpful)
- Include generic names alongside brand names
- Use standard Pakistani prescription format: medication name, dosage, frequency, duration, instructions
- Flag any potential drug interactions based on the patient's known medications and allergies
- Flag if any medication is contraindicated for the patient's age, gender, or conditions
- Include appropriate warnings for each medication
- Suggest lab tests if relevant
- NEVER include controlled substances (Schedule H drugs) without explicit flagging
- State uncertainty plainly — if the transcript or notes don't clearly support a finding, say so rather than guessing
- Never invent a detail the patient or doctor didn't actually say. If something is genuinely unclear or missing, list it under contraindication_flags as something for the doctor's attention instead of filling the gap yourself
- The doctor reviews, edits, and must explicitly approve every draft before anything reaches the patient.
- This is a DRAFT for doctor review — it is never sent to a patient directly

Return ONLY valid JSON:
{
  "diagnosis": "...",
  "medications": [
    { "name": "brand name (generic name)", "dosage": "e.g. 500mg", "frequency": "e.g. 3 times daily", "duration": "e.g. 7 days",
      "route": "oral / topical / injection / etc", "instructions": "e.g. Take after meals with water", "quantity": 21, "warnings": ["specific warnings for this drug"] }
  ],
  "lab_tests": [{ "name": "...", "reason": "..." }],
  "advice": ["lifestyle/care advice items"],
  "follow_up": "when to come back",
  "emergency_instructions": "when to go to ER",
  "drug_interaction_warnings": ["any interactions with existing medications"],
  "contraindication_flags": ["any flags based on patient profile, and anything uncertain that needs the doctor's attention"]
}`;

interface DraftContext {
  intakeSummary?: string | null;
  callTranscript?: string | null;
  visitSummary: string | null;
  doctorNotes: string | null;
  knownAllergies: string[];
  currentMedications: string[];
  patientAge: number | null;
  patientGender: string | null;
}

export async function generatePrescriptionDraft(ctx: DraftContext): Promise<PrescriptionData> {
  const content = [
    ctx.intakeSummary ? `Patient intake: ${ctx.intakeSummary}` : null,
    ctx.callTranscript ? `Call transcript: ${ctx.callTranscript}` : null,
    ctx.visitSummary ? `Visit summary: ${ctx.visitSummary}` : null,
    ctx.doctorNotes ? `Doctor's notes: ${ctx.doctorNotes}` : null,
    `Patient age: ${ctx.patientAge ?? "unknown"}, gender: ${ctx.patientGender ?? "unknown"}`,
    `Known allergies: ${ctx.knownAllergies.length ? ctx.knownAllergies.join(", ") : "none reported"}`,
    `Current medications: ${ctx.currentMedications.length ? ctx.currentMedications.join(", ") : "none reported"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await complete({
    system: PRESCRIPTION_SYSTEM,
    content,
    maxTokens: 2000,
  });
  return extractJson<PrescriptionData>(raw);
}
