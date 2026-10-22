// Symptom triage: deterministic emergency safety net (English, Urdu script and
// Roman Urdu) + the fixed specialty list. Specialty values match the labels the
// doctor registration form stores in doctors.specialization.
import { SPECIALIZATIONS } from "@/components/doctor/registration/types";
import { detectEmergency } from "@/lib/clinicalSafety";

export const SPECIALTY_LABELS: string[] = SPECIALIZATIONS.map(([, label]) => label);
export const FALLBACK_SPECIALTY = "General Physician";
export type TriageUrgency = "emergency" | "urgent" | "routine";

export interface TriageResult {
  specialty: string;
  urgency: TriageUrgency;
  summary: string;
  red_flags: string[];
  safety_net_match: string | null;
}

// Roman Urdu / extra English phrases the shared EMERGENCY_KEYWORDS list misses.
// Regexes so spelling variants (seene/sine, mein/me/main) still match.
const EXTRA_EMERGENCY: { re: RegExp; label: string }[] = [
  { re: /\b(seen[ae]|sine|sinay|chhati|chati)\s*(m[ae]i?n?|me)?\s*(dard|dart|pain)/i, label: "seene mein dard (chest pain)" },
  { re: /\bdil\s*(ka)?\s*(dora|daura|attack)/i, label: "dil ka daura (heart attack)" },
  { re: /\bsaa?n?s\s*(nahi|nai|nhi|na)\s*(aa?|a)\s*(rahi|rhi|raha)/i, label: "saans nahi aa rahi (can't breathe)" },
  { re: /\bsaa?n?s\s*(lene|leny|lenay)\s*(m[ae]i?n?|me)?\s*(takleef|mushkil|dikkat|problem)/i, label: "saans lene mein takleef (breathing difficulty)" },
  { re: /\b(difficulty|trouble|hard|shortness of)\s*(in\s*)?breath/i, label: "difficulty breathing" },
  { re: /\bbe\s*-?hosh|\bbehosh/i, label: "behosh (unconscious)" },
  { re: /\bfaa?la?j\b|\blaqwa\b|face\s*(is\s*)?droop|slurred speech|one side (of )?(the )?body/i, label: "stroke signs" },
  { re: /\bkhoo?n\s*(bohat|bahut|bht|bohot|zyada|ziada)\s*(beh|bah|nikal)/i, label: "khoon bohat beh raha (severe bleeding)" },
  { re: /\bkhud\s*-?ku?shi|\bmar(na)?\s*(jana|jaana)\s*cha?ha?ta|\bjeena\s*nahi\s*chahta|\bend(ing)?\s+(my|his|her|their)\s+(own\s+)?life|\btake\s+my\s+(own\s+)?life|\bself[-\s]?harm|\bhurt(ing)?\s+myself|\bsuicid/i, label: "suicidal thoughts" },
  { re: /\bdora\s*(par|pr|pad)|\bjhatk[ey]|\bmirgi/i, label: "seizure" },
  { re: /\bzeh[ae]r\b/i, label: "zehar (poisoning)" },
];

export function triageSafetyNet(text: string): string | null {
  const shared = detectEmergency(text);
  if (shared.isEmergency) return shared.matchedKeyword;
  const hit = EXTRA_EMERGENCY.find((e) => e.re.test(text));
  return hit ? hit.label : null;
}

export const TRIAGE_SYSTEM = `You are a medical triage assistant for Ostrix, a Pakistani telehealth app. You are NOT a doctor and you never diagnose.
The patient may write in English, Urdu script or Roman Urdu (Urdu typed in Latin letters, e.g. "mujhe 3 din se bukhar hai"). Understand all three.

Return ONLY valid JSON:
{
  "specialty": "exactly one of: ${SPECIALTY_LABELS.join(" | ")}",
  "urgency": "emergency | urgent | routine",
  "summary": "2-3 short sentences in simple English for the patient and doctor: what the patient reports and why this specialist. Describe ONLY the reported symptoms and the specialist. Never name or hint at a disease, infection or condition (no \"suggests\", \"likely\", \"infection\", \"issue\").",
  "red_flags": ["2-4 warning signs that mean go to hospital / call 1122 immediately"]
}

Rules:
- emergency = chest pain, breathing difficulty, stroke signs, severe bleeding, unconsciousness, seizures, poisoning, suicidal thoughts, severe allergic reaction, or anything life-threatening.
- urgent = should see a doctor today (e.g. high fever in a young child, worsening severe pain).
- routine = can wait for a normal appointment.
- If unsure which specialty, use "General Physician". Children -> "Pediatrician"; pregnancy issues -> "Gynecologist".`;

export function normalizeTriage(raw: Partial<TriageResult> & Record<string, unknown>, safetyNet: string | null): TriageResult {
  const specialty =
    SPECIALTY_LABELS.find((s) => s.toLowerCase() === String(raw.specialty || "").toLowerCase().trim()) || FALLBACK_SPECIALTY;
  let urgency: TriageUrgency = ["emergency", "urgent", "routine"].includes(String(raw.urgency))
    ? (raw.urgency as TriageUrgency)
    : "routine";
  if (safetyNet) urgency = "emergency";
  return {
    specialty,
    urgency,
    summary: String(raw.summary || "").slice(0, 800),
    red_flags: Array.isArray(raw.red_flags) ? raw.red_flags.map(String).slice(0, 6) : [],
    safety_net_match: safetyNet,
  };
}
