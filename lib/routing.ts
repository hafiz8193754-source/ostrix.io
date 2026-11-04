// Instant specialist routing from the patient's FIRST message.
// Product rule: never ask follow-up / history questions before connecting the
// patient to a doctor. If unclear, route to General Physician.
import { SPECIALIZATIONS } from "@/components/doctor/registration/types";

export const SPECIALIZATION_KEYS: string[] = SPECIALIZATIONS.map(([k]) => k);
export const DEFAULT_SPECIALIZATION = "general_physician";

export function specializationLabel(key: string): string {
  return SPECIALIZATIONS.find(([k]) => k === key)?.[1] || "General Physician";
}

// English + Roman Urdu keyword hints. First match wins, so more specific rules first.
const RULES: { key: string; re: RegExp; reason: string }[] = [
  { key: "pediatrician", re: /\b(baby|infant|toddler|my (son|daughter|child|kid)|child|bacch?[ae]|bachi|bacha|beta|beti)\b/i, reason: "A child's health concern is best seen by a Pediatrician." },
  { key: "gynecologist", re: /\b(pregnan\w*|period|periods|menstrua\w*|haiz|hamal|hamla|white discharge|likoria|leukorr?h?oea)\b/i, reason: "Women's health and pregnancy concerns are handled by a Gynecologist." },
  { key: "dentist", re: /\b(tooth|teeth|dant|daant|daar[h]?|gum|gums|masoor[ae]|toothache)\b/i, reason: "Tooth and gum problems are treated by a Dentist." },
  { key: "ophthalmologist", re: /\b(eye|eyes|aankh|ankh|aankhon|ankhon|vision|nazar|blurry)\b/i, reason: "Eye problems are treated by an Eye Specialist." },
  { key: "ent", re: /\b(ear|ears|kaan|kan|throat|gala|gal[ae] (mein|me) dard|tonsil\w*|sinus|nose|naak|nak)\b/i, reason: "Ear, nose and throat problems are treated by an ENT Specialist." },
  { key: "dermatologist", re: /\b(skin|rash|rashes|kharish|khujli|acne|pimples?|daane|dane|eczema|jild|allerg\w* on skin|itch\w*|hair fall|baal gir)\b/i, reason: "Skin, rash and itching problems are treated by a Dermatologist." },
  { key: "psychiatrist", re: /\b(anxiety|depress\w*|stress|panic|ghabrahat|udaas|udasi|neend nahi|insomnia|mental)\b/i, reason: "Stress, anxiety and mood concerns are handled by a Psychiatrist." },
  { key: "orthopedic", re: /\b(bone|bones|haddi|haddiyon|joint|joints|jor|joron|knee|ghutn[ae]|back pain|kamar|kamr|fracture|sprain|moch)\b/i, reason: "Bone, joint and back pain are treated by an Orthopedic Surgeon." },
  { key: "gastroenterologist", re: /\b(stomach|abdomen|abdominal|pait|pet|paet|maida|meda|diarrh?o?ea|dast|loose motion|constipation|qabz|acidity|tezabiyat|vomit\w*|ulti|ultiyan|gas)\b/i, reason: "Stomach and digestion problems are treated by a Gastroenterologist." },
  { key: "urologist", re: /\b(urine|peshab|pishab|burning urination|kidney stone|pathri)\b/i, reason: "Urine and kidney-stone problems are treated by a Urologist." },
  { key: "endocrinologist", re: /\b(diabetes|sugar|thyroid|harmone|hormone)\b/i, reason: "Diabetes, sugar and thyroid problems are handled by an Endocrinologist." },
  { key: "neurologist", re: /\b(migraine|headache|sar ?dard|sir ?dard|chakkar|dizz\w*|numb\w*|sun ho)\b/i, reason: "Headache, migraine and dizziness are seen by a Neurologist." },
  { key: "general_physician", re: /\b(fever|bukhar|bukhaar|cough|khansi|khaansi|flu|zukam|nazla|cold|weakness|kamzori|body ache|jism (mein|me) dard)\b/i, reason: "Fever, cough and general symptoms are best seen first by a General Physician." },
];

export interface RouteResult {
  specialization: string;
  reason: string;
}

export function routeByKeywords(text: string): RouteResult {
  if (isGastroComplaint(text)) return { specialization: "gastroenterologist", reason: GASTRO_REASON };
  const hit = RULES.find((r) => r.re.test(text));
  if (hit) return { specialization: hit.key, reason: hit.reason };
  return { specialization: DEFAULT_SPECIALIZATION, reason: "A General Physician can see you first and refer you if needed." };
}

// Owner rule: stomach / abdominal complaints ALWAYS go to Gastroenterologist,
// regardless of what the model says (emergency checks run before this).
export const GASTRO_RE = /\b(stomach|abdomen|abdominal|tummy|pait|pet|paet|maida|meda|maiday|diarrh?o?ea|dast|loose motions?|constipation|qabz|acidity|tezabiyat|heartburn|vomit\w*|ulti|ultiyan|gas)\b/i;
const GASTRO_REASON = "Stomach and digestion problems are treated by a Gastroenterologist.";

export function isGastroComplaint(text: string): boolean {
  return GASTRO_RE.test(text);
}

/** Pick a valid specialization from the model output; fall back to keywords, then General Physician. */
export function resolveRoute(text: string, model: { specialization?: unknown; reason?: unknown } | null): RouteResult {
  if (isGastroComplaint(text)) return { specialization: "gastroenterologist", reason: GASTRO_REASON };
  const key = String(model?.specialization || "").trim().toLowerCase();
  const reason = oneLine(String(model?.reason || ""));
  if (SPECIALIZATION_KEYS.includes(key)) {
    return { specialization: key, reason: reason || routeByKeywords(text).reason };
  }
  return routeByKeywords(text);
}

export function oneLine(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const first = flat.match(/^.*?[.!?](\s|$)/)?.[0]?.trim() || flat;
  return first.length > 180 ? `${first.slice(0, 177)}…` : first;
}

export const ROUTING_SYSTEM = `You route patients of Ostrix (a Pakistani telehealth app) to the right type of doctor from ONE message. You are NOT a doctor and never diagnose.
The patient may write English, Urdu script or Roman Urdu (e.g. "pait mein dard", "bukhar aur khansi").

NEVER ask the patient any question. NEVER ask for history, duration, age, medicines or more details. Decide from the message alone.
If the message is vague or unclear, choose "general_physician".

Return ONLY valid JSON:
{
  "specialization": "one of: ${SPECIALIZATIONS.map(([k]) => k).join(", ")}",
  "urgency": "routine | soon | urgent | emergency",
  "reason": "ONE short sentence in simple English: which specialist and why (no diagnosis, no disease names, no questions)"
}

Rules:
- chest pain, breathing difficulty, stroke signs, severe bleeding, unconsciousness, seizures, poisoning, suicidal thoughts -> urgency "emergency".
- Stomach / abdominal pain, "pait mein dard", "pet dard", acidity, gas, vomiting, diarrhoea, constipation -> ALWAYS "gastroenterologist".
- Children -> pediatrician. Pregnancy / periods -> gynecologist. Unsure -> general_physician.`;
