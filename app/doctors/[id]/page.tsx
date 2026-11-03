import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";

import { PublicHeader } from "@/components/booking/PublicHeader";
import { DoctorAvatar } from "@/components/booking/DoctorAvatar";
import { BookingForm } from "@/components/booking/BookingForm";
import { createAnonAuthClient } from "@/lib/serverAuth";
import { doctorPhoto, getApprovedDoctor, getDoctorSlots } from "@/lib/publicDoctors";
import { doctorName, specialtyLabel } from "@/lib/doctorDisplay";

export const dynamic = "force-dynamic";

export default async function DoctorProfilePage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = createAnonAuthClient();
  const doctor = await getApprovedDoctor(db, params.id);
  if (!doctor) notFound();
  const days = await getDoctorSlots(db, doctor.id);

  return (
    <div className="min-h-screen bg-bg-base">
      <PublicHeader />
      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-4 py-6 md:grid-cols-[1fr_1.2fr]">
        <section className="flex min-w-0 flex-col gap-4">
          <Link href="/doctors" className="inline-flex min-h-[44px] items-center gap-1 self-start text-sm font-medium text-text-secondary hover:text-text-primary">
            <ArrowLeft className="h-4 w-4" /> All doctors
          </Link>
          <div className="flex min-w-0 items-center gap-4">
            <DoctorAvatar name={doctor.full_name} url={doctorPhoto(doctor)} className="h-20 w-20 text-2xl sm:h-24 sm:w-24" />
            <div className="min-w-0">
              <h1 className="break-words font-display text-2xl font-bold text-text-primary">{doctorName(doctor.full_name)}</h1>
              <p className="text-base text-text-secondary">{specialtyLabel(doctor.specialization)}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent"><BadgeCheck className="h-4 w-4" /> PMDC verified</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-bg-surface p-4 text-sm">
            <div><dt className="text-text-muted">PMDC number</dt><dd className="font-semibold text-text-primary">{doctor.pmdc_number}</dd></div>
            <div><dt className="text-text-muted">Fee</dt><dd className="font-semibold text-text-primary">{doctor.consultation_fee_pkr > 0 ? `PKR ${doctor.consultation_fee_pkr.toLocaleString()}` : "Not listed"}</dd></div>
            <div><dt className="text-text-muted">Experience</dt><dd className="font-semibold text-text-primary">{doctor.experience_years} years</dd></div>
            <div><dt className="text-text-muted">City</dt><dd className="font-semibold text-text-primary">{doctor.city}</dd></div>
            <div className="col-span-2"><dt className="text-text-muted">Qualifications</dt><dd className="break-words text-text-primary">{doctor.qualifications}</dd></div>
            {doctor.clinic_name && <div className="col-span-2"><dt className="text-text-muted">Clinic</dt><dd className="break-words text-text-primary">{doctor.clinic_name}</dd></div>}
            {doctor.languages?.length ? <div className="col-span-2"><dt className="text-text-muted">Languages</dt><dd className="text-text-primary">{doctor.languages.join(", ")}</dd></div> : null}
          </dl>
          {doctor.bio && <p className="whitespace-pre-line break-words text-base text-text-secondary">{doctor.bio}</p>}
        </section>

        <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-bg-surface p-4">
          <h2 className="font-display text-lg font-semibold text-text-primary">Book a time</h2>
          <BookingForm doctor={doctor} initialDays={days} />
        </section>
      </main>
    </div>
  );
}
