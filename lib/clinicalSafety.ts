// Shared between the server (authoritative gate, runs before any AI call) and
// the client (instant UI short-circuit — no network round trip before an
// emergency banner appears). Keep the two in sync by only editing this file.

export const EMERGENCY_KEYWORDS = [
  "chest pain",
  "heart attack",
  "stroke",
  "can't breathe",
  "cant breathe",
  "not breathing",
  "unconscious",
  "severe bleeding",
  "heavy bleeding",
  "poisoning",
  "poison",
  "suicide",
  "kill myself",
  "want to die",
  "overdose",
  "seizure",
  "convulsion",
  "choking",
  "drowning",
  "burn",
  "electric shock",
  "snake bite",
  "accident",
  "head injury",
  "unconscious child",
  "baby not breathing",
  "severe abdominal pain",
  // Urdu
  "سینے میں درد",
  "سانس نہیں آ رہی",
  "بے ہوش",
  "خون بہت بہہ رہا",
  "زہر",
  "خودکشی",
];

export interface EmergencyResult {
  isEmergency: boolean;
  matchedKeyword: string | null;
}

export function detectEmergency(text: string): EmergencyResult {
  const lower = text.toLowerCase();
  const matched = EMERGENCY_KEYWORDS.find((kw) => lower.includes(kw.toLowerCase()));
  return { isEmergency: !!matched, matchedKeyword: matched ?? null };
}

export const EMERGENCY_HOSPITALS = [
  { name: "Mayo Hospital", phone: "042-99211200" },
  { name: "Jinnah Hospital", phone: "042-99231400" },
  { name: "Services Hospital", phone: "042-99200601" },
];

// Keyword-specific first-aid guidance shown while help is on the way. Falls
// back to generic guidance if the matched keyword has no specific entry.
const FIRST_AID: Record<string, string> = {
  "chest pain": "Sit the person down, loosen tight clothing, keep them calm and still. Do not let them walk or exert themselves.",
  "heart attack": "Sit the person down, loosen tight clothing, keep them calm and still. Do not let them walk or exert themselves.",
  choking: "If they can cough, let them keep coughing. If they can't breathe or speak, perform back blows/abdominal thrusts if trained.",
  "severe bleeding": "Apply firm, direct pressure to the wound with a clean cloth. Keep the injured area raised above heart level if possible.",
  "heavy bleeding": "Apply firm, direct pressure to the wound with a clean cloth. Keep the injured area raised above heart level if possible.",
  burn: "Cool the burn under running water for 20 minutes. Do not apply ice, butter, or ointments. Cover loosely with clean cloth.",
  poisoning: "Do not induce vomiting unless told to by a medical professional. Keep the substance/container to show responders.",
  poison: "Do not induce vomiting unless told to by a medical professional. Keep the substance/container to show responders.",
  seizure: "Clear the area of hard objects, cushion their head, turn them on their side. Do not restrain them or put anything in their mouth.",
  convulsion: "Clear the area of hard objects, cushion their head, turn them on their side. Do not restrain them or put anything in their mouth.",
  unconscious: "Check breathing. If breathing, place in the recovery position on their side. If not breathing, begin CPR if trained.",
};

export function firstAidFor(matchedKeyword: string | null): string {
  if (!matchedKeyword) return "Stay with the person, keep them calm, and follow the dispatcher's instructions when you call 1122.";
  return FIRST_AID[matchedKeyword] || "Stay with the person, keep them calm, and follow the dispatcher's instructions when you call 1122.";
}

export const CLINICAL_DISCLAIMER =
  "Ostrix Clinical is an AI-assisted decision support tool. It does not diagnose or prescribe. All medical decisions are made by PMDC-registered doctors. In emergencies, call 1122.";
