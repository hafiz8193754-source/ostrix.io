-- Account deletion (/api/account/delete) failed with 500 for anyone who had a
-- consultation/prescription, or for an admin who had verified a doctor,
-- because these FKs had no ON DELETE action. Clinical records follow the
-- patient/doctor row (cascade, as the delete route promises a full wipe);
-- reviewer references and the audit trail are kept with the link nulled.
alter table public.doctors drop constraint if exists doctors_verified_by_fkey,
  add constraint doctors_verified_by_fkey foreign key (verified_by) references auth.users(id) on delete set null;
alter table public.doctor_verification_log drop constraint if exists doctor_verification_log_changed_by_fkey,
  add constraint doctor_verification_log_changed_by_fkey foreign key (changed_by) references auth.users(id) on delete set null;
alter table public.consultations drop constraint if exists consultations_patient_id_fkey,
  add constraint consultations_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;
alter table public.consultations drop constraint if exists consultations_doctor_id_fkey,
  add constraint consultations_doctor_id_fkey foreign key (doctor_id) references public.doctors(id) on delete cascade;
alter table public.prescriptions drop constraint if exists prescriptions_patient_id_fkey,
  add constraint prescriptions_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;
alter table public.prescriptions drop constraint if exists prescriptions_doctor_id_fkey,
  add constraint prescriptions_doctor_id_fkey foreign key (doctor_id) references public.doctors(id) on delete cascade;
alter table public.clinical_audit_log drop constraint if exists clinical_audit_log_consultation_id_fkey,
  add constraint clinical_audit_log_consultation_id_fkey foreign key (consultation_id) references public.consultations(id) on delete set null;
alter table public.clinical_audit_log drop constraint if exists clinical_audit_log_prescription_id_fkey,
  add constraint clinical_audit_log_prescription_id_fkey foreign key (prescription_id) references public.prescriptions(id) on delete set null;
