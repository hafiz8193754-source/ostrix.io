import { NextResponse } from "next/server";
import { requireVerifiedDoctor } from "@/lib/doctorGuard";
import { prescriptionDraftSchema } from "@/lib/schemas";
import { getConsultation, getPatientById, savePrescriptionDraft, logClinicalAudit } from "@/lib/clinical";
import { generatePrescriptionDraft } from "@/lib/clinicalAI";

export const maxDuration = 300;

export async function POST(request: Request) {
  const guard = await requireVerifiedDoctor(request);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { doctor } = guard;

  const body = await request.json();
  const parsed = prescriptionDraftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const consultation = await getConsultation(guard.db, parsed.data.consultation_id);
  if (!consultation) return NextResponse.json({ error: "Consultation not found." }, { status: 404 });
  if (consultation.doctor_id !== doctor.id)
    return NextResponse.json({ error: "You are not the doctor assigned to this consultation." }, { status: 403 });

  const patient = await getPatientById(guard.db, consultation.patient_id);
  if (!patient) return NextResponse.json({ error: "Could not load consultation details." }, { status: 500 });

  try {
    const draft = await generatePrescriptionDraft({
      visitSummary: consultation.ai_visit_summary,
      doctorNotes: consultation.doctor_notes,
      knownAllergies: patient.known_allergies,
      currentMedications: patient.current_medications,
      patientAge: patient.age,
      patientGender: patient.gender,
    });

    const prescription = await savePrescriptionDraft(guard.db, 
      consultation.id,
      doctor.id,
      patient.id,
      doctor.pmdc_number,
      draft,
      [...draft.drug_interaction_warnings, ...draft.contraindication_flags],
      draft.drug_interaction_warnings
    );
    if (!prescription) return NextResponse.json({ error: "Could not save the draft." }, { status: 500 });

    await logClinicalAudit(guard.db, consultation.id, prescription.id, "ai", "prescription_drafted", { medicationCount: draft.medications.length });

    return NextResponse.json({
      prescription_id: prescription.id,
      draft,
      warnings: prescription.warnings,
      drug_interactions: prescription.drug_interactions,
      status: prescription.status,
    });
  } catch {
    return NextResponse.json({ error: "Could not draft a prescription right now." }, { status: 502 });
  }
}
