import { NextResponse } from "next/server";
import { complete, extractJson } from "@/lib/ai";
import { getUserFromRequest } from "@/lib/serverAuth";
import { symptomAnalysisSchema } from "@/lib/schemas";
import { detectEmergency, firstAidFor, EMERGENCY_HOSPITALS, CLINICAL_DISCLAIMER } from "@/lib/clinicalSafety";
import { searchDoctors, logClinicalAudit } from "@/lib/clinical";
import { runPresenceSweep } from "@/lib/presenceSweep";
import type { SymptomAnalysis, Urgency } from "@/types";

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

const SYSTEM = `You are a medical triage assistant inside the Ostrix platform. You are NOT a doctor and you do NOT diagnose. Your job is to understand the patient's symptoms and suggest which type of medical specialist they should consult.

Based on the symptoms described, respond with ONLY valid JSON:
{
  "specialization": "one of: ${SPECIALIZATIONS.join(", ")}",
  "urgency": "one of: routine (can wait days), soon (within 24-48 hours), urgent (today), emergency (immediately)",
  "reasoning": "one paragraph explaining why this specialist type is suggested — in simple language the patient can understand",
  "questions_for_doctor": ["3-5 important questions the patient should ask the doctor"],
  "red_flags": ["2-3 warning signs that mean they should go to the emergency room immediately instead of waiting for an appointment"]
}

CRITICAL RULES:
- NEVER diagnose. Say "your symptoms suggest you should see a [specialist]" not "you have [disease]".
- For ANY mention of chest pain, difficulty breathing, severe bleeding, unconsciousness, suicidal thoughts, poisoning, or stroke symptoms — ALWAYS set urgency to "emergency".
- For children under 5 with high fever — always set urgency to "urgent" minimum.
- If symptoms are vague or could point to multiple specializations, suggest starting with general_physician.`;

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
  const emergency = detectEmergency(symptoms);
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

  try {
    // The patient is waiting in the studio intake chat. The fast model returns
    // inside the function budget. Visit summaries and prescription drafts stay
    // on XAI_MODEL.
    const raw = await complete({ system: SYSTEM, content: symptoms, maxTokens: 1200, fast: true });
    const parsedAnalysis = extractJson<{
      specialization: string;
      urgency: Urgency;
      reasoning: string;
      questions_for_doctor: string[];
      red_flags: string[];
    }>(raw);

    const specialization = SPECIALIZATIONS.includes(parsedAnalysis.specialization)
      ? parsedAnalysis.specialization
      : "general_physician";
    let urgency = parsedAnalysis.urgency;
    if (patientAge !== undefined && patientAge < 5 && urgency === "routine") urgency = "urgent";

    const analysis: SymptomAnalysis = {
      specialization,
      urgency,
      reasoning: parsedAnalysis.reasoning,
      questions_for_doctor: parsedAnalysis.questions_for_doctor || [],
      red_flags: parsedAnalysis.red_flags || [],
      disclaimer: CLINICAL_DISCLAIMER,
    };

    await runPresenceSweep();
    const matching_doctors = await searchDoctors(db, { specialization, city });

    await logClinicalAudit(db, null, null, "ai", "symptom_analysis", { symptoms, patientAge, patientGender, analysis });

    return NextResponse.json({
      emergency: false,
      suggested_specialization: specialization,
      suggested_specialization_display: DISPLAY_NAMES[specialization] || specialization,
      suggested_specialization_urdu: URDU_NAMES[specialization] || "",
      urgency: analysis.urgency,
      reasoning: analysis.reasoning,
      important_note: CLINICAL_DISCLAIMER,
      questions_to_ask_doctor: analysis.questions_for_doctor,
      red_flags: analysis.red_flags,
      matching_doctors,
    });
  } catch {
    return NextResponse.json({ error: "Could not analyze symptoms right now." }, { status: 502 });
  }
}
