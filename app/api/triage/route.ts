import { NextResponse } from "next/server";
import { z } from "zod";
import { complete, extractJson } from "@/lib/ai";
import { getUserFromRequest } from "@/lib/serverAuth";
import { searchDoctors, logClinicalAudit } from "@/lib/clinical";
import { runPresenceSweep } from "@/lib/presenceSweep";
import { CLINICAL_DISCLAIMER, EMERGENCY_HOSPITALS } from "@/lib/clinicalSafety";
import { FALLBACK_SPECIALTY, TRIAGE_SYSTEM, normalizeTriage, triageSafetyNet, type TriageResult } from "@/lib/triage";

export const maxDuration = 60;

const schema = z.object({ symptoms: z.string().trim().min(3, "Describe your symptoms.").max(2000) });

export async function POST(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { db } = auth;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  const { symptoms } = parsed.data;

  // Deterministic net first: an emergency never waits on (or depends on) the model.
  const safetyNet = triageSafetyNet(symptoms);
  let triage: TriageResult;
  if (safetyNet) {
    triage = normalizeTriage(
      {
        specialty: FALLBACK_SPECIALTY,
        summary: "Your symptoms may be a medical emergency. Please get help right now.",
        red_flags: [],
      },
      safetyNet
    );
  } else {
    try {
      const raw = await complete({ system: TRIAGE_SYSTEM, content: symptoms, maxTokens: 700, fast: true });
      triage = normalizeTriage(extractJson(raw), null);
    } catch {
      return NextResponse.json({ error: "Could not analyse symptoms right now. Please try again." }, { status: 502 });
    }
  }

  await logClinicalAudit(db, null, null, "ai", "symptom_triage", { urgency: triage.urgency, specialty: triage.specialty, safety_net: safetyNet });

  if (triage.urgency === "emergency") {
    return NextResponse.json({ triage, emergency: true, hospitals: EMERGENCY_HOSPITALS, disclaimer: CLINICAL_DISCLAIMER, doctors: [] });
  }

  await runPresenceSweep().catch(() => undefined);
  let doctors = await searchDoctors(db, { specialization: triage.specialty });
  let matched_specialty = triage.specialty;
  if (!doctors.length && triage.specialty !== FALLBACK_SPECIALTY) {
    doctors = await searchDoctors(db, { specialization: FALLBACK_SPECIALTY });
    matched_specialty = FALLBACK_SPECIALTY;
  }
  return NextResponse.json({ triage, emergency: false, matched_specialty, doctors, disclaimer: CLINICAL_DISCLAIMER });
}
