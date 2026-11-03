import { NextResponse } from "next/server";
import { complete, extractJson } from "@/lib/ai";
import { getUserFromRequest } from "@/lib/serverAuth";
import { symptomAnalysisSchema } from "@/lib/schemas";
import { detectEmergency, firstAidFor, EMERGENCY_HOSPITALS, CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import { searchDoctors, logClinicalAudit } from "@/lib/clinical";
import { runPresenceSweep } from "@/lib/presenceSweep";
import type { SymptomAnalysis, Urgency } from "@/types";
import { ROUTING_SYSTEM, resolveRoute, DEFAULT_SPECIALIZATION } from "@/lib/routing";
import { triageSafetyNet } from "@/lib/triage";

export const maxDuration = 90;

const SPECIALIZATIONS = [
  "general_physician", "cardiologist", "dermatologist", "orthopedic", "gynecologist",
  "pediatrician", "ent", "dentist", "ophthalmologist", "neurologist", "psychiatrist",
  "urologist", "pulmonologist", "gastroenterologist", "endocrinologist", "oncologist",
  "nephrologist", "rheumatologist", "emergency",
];

const DISPLAY_NAMES: Record<string, string> = {
  general_physician: "General Physician",
  cardiologist: "Cardiologist",
  dermatologist: "Dermatologist",
  orthopedic: "Orthopedic Surgeon",
  gynecologist: "Gynecologist",
  pediatrician: "Pediatrician",
  ent: "ENT Specialist",
  dentist: "Dentist",
  ophthalmologist: "Eye Specialist",
  neurologist: "Neurologist",
  psychiatrist: "Psychiatrist",
  urologist: "Urologist",
  pulmonologist: "Pulmonologist",
  gastroenterologist: "Gastroenterologist",
  endocrinologist: "Endocrinologist",
  oncologist: "Oncologist",
  nephrologist: "Nephrologist",
  rheumatologist: "Rheumatologist",
  emergency: "Emergency Medicine",
};

const URDU_NAMES: Record<string, string> = {
  general_physician: "جنرل فزیشن",
  cardiologist: "ماہر امراض قلب",
  dermatologist: "ماہر امراض جلد",
  orthopedic: "ماہر ہڈیوں",
  gynecologist: "ماہر امراض نسواں",
  pediatrician: "ماہر اطفال",
  ent: "ماہر کان ناک گلا",
  dentist: "ماہر دندان",
  ophthalmologist: "ماہر امراض چشم",
  neurologist: "ماہر اعصاب",
  psychiatrist: "ماہر نفسیات",
  urologist: "ماہر امراض گردہ",
  pulmonologist: "ماہر امراض سینہ",
  gastroenterologist: "ماہر معدہ و آنت",
  endocrinologist: "ماہر ہارمونز",
  oncologist: "ماہر سرطان",
  nephrologist: "ماہر امراض گردہ",
  rheumatologist: "ماہر جوڑوں",
  emergency: "ایمرجنسی",
};

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user, db } = auth;

  const body = await request.json();
  const parsed = symptomAnalysisSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { symptoms, patientAge, patientAgeMonths, patientGender, city } = parsed.data;

  // Emergency detection runs BEFORE any AI call — no delay when it matters.
  const detected = detectEmergency(symptoms);
  const safetyNet = detected.isEmergency ? null : triageSafetyNet(symptoms);
  const emergency = safetyNet
    ? { isEmergency: true, matchedKeyword: detected.matchedKeyword }
    : detected;
  const isInfantUnder3Months = patientAgeMonths !== undefined && patientAgeMonths < 3;
  if (emergency.isEmergency || isInfantUnder3Months) {
    await logClinicalAudit(db, null, null, "system", "emergency_detected", {
      symptoms,
      matchedKeyword: emergency.matchedKeyword,
      isInfantUnder3Months,
    });
    return NextResponse.json({
      emergency: true,
      matched_keyword: emergency.matchedKeyword,
      first_aid: isInfantUnder3Months && !emergency.matchedKeyword
        ? "Any symptom in an infant under 3 months old needs immediate medical attention — infants this young can deteriorate very quickly. Do not wait."
        : firstAidFor(emergency.matchedKeyword),
      hospitals: EMERGENCY_HOSPITALS,
      important_note: CLINICAL_DISCLAIMER,
    });
  }

  // Instant routing: one message -> specialist + doctors. Never ask follow-up
  // questions. If the AI is slow/unavailable, fall back to keyword routing.
  let model: { specialization?: string; urgency?: Urgency; reason?: string } | null = null;
  try {
    const raw = await complete({ system: ROUTING_SYSTEM, content: symptoms, maxTokens: 200, fast: true });
    model = extractJson<{ specialization: string; urgency: Urgency; reason: string }>(raw);
  } catch {
    model = null;
  }
  const route = resolveRoute(symptoms, model);
  const specialization = route.specialization;
  const validUrgency: Urgency[] = ["routine", "soon", "urgent", "emergency"];
  let urgency: Urgency = model?.urgency && validUrgency.includes(model.urgency) ? model.urgency : "soon";
  if (patientAge !== undefined && patientAge < 5 && urgency === "routine") urgency = "urgent";

  const analysis: SymptomAnalysis = {
    specialization,
    urgency,
    reasoning: route.reason,
    questions_for_doctor: [],
    red_flags: [],
    disclaimer: CLINICAL_DISCLAIMER,
  };

  try {
    await runPresenceSweep();
  } catch {
    /* non-blocking */
  }
  let matching_doctors = await searchDoctors(db, { specialization, city });
  let fallback_to_general = false;
  if (!matching_doctors.length && specialization !== DEFAULT_SPECIALIZATION) {
    matching_doctors = await searchDoctors(db, { specialization: DEFAULT_SPECIALIZATION, city });
    fallback_to_general = matching_doctors.length > 0;
  }

  await logClinicalAudit(db, null, null, "ai", "symptom_analysis", { symptoms, patientAge, patientGender, analysis });

  return NextResponse.json({
    emergency: false,
    suggested_specialization: specialization,
    suggested_specialization_display: DISPLAY_NAMES[specialization] || specialization,
    suggested_specialization_urdu: URDU_NAMES[specialization] || "",
    urgency: analysis.urgency,
    reasoning: analysis.reasoning,
    important_note: CLINICAL_DISCLAIMER,
    questions_to_ask_doctor: [],
    red_flags: [],
    fallback_to_general,
    matching_doctors,
  });
}
