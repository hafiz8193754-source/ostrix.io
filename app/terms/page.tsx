import type { Metadata } from "next";
import Link from "next/link";

import { LegalContact } from "@/components/legal/LegalContact";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Terms of service — ${BRAND.name}`,
  description: `The terms for using ${BRAND.name} to book a PMDC-licensed doctor online.`,
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="19 November 2026">
      <section className="flex flex-col gap-2">
        <h2>The service</h2>
        <p>
          {BRAND.name} lets you describe symptoms, book a time with a doctor, join an online visit, and receive a prescription that doctor has reviewed and signed. These terms cover use of the website, the apps, and the related messages.
        </p>
        <LegalContact />
      </section>
      <section className="flex flex-col gap-2">
        <h2>Doctors</h2>
        <p>
          Doctors who consult on {BRAND.name} are licensed by the Pakistan Medical and Dental Council (PMDC). We check that registration before a doctor can take patients. The consultation is with that doctor. {BRAND.name} provides the booking and communication tools. It is not itself your doctor, and it does not practise medicine.
        </p>
        <p>
          If you are outside Pakistan, check whether an online consultation and a prescription from a PMDC-licensed doctor can be used where you are.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>AI is not a diagnosis</h2>
        <p>
          Symptom checks, transcripts, and draft notes are AI tools that organise information for you and the doctor. They are not a diagnosis, not a treatment plan, and not a prescription. Only the doctor decides on your care and signs a prescription. Do not act on an AI draft as if a doctor had approved it.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Emergencies</h2>
        <p>
          {BRAND.name} is not for emergencies. If you have chest pain, trouble breathing, severe bleeding, a collapse, or any other emergency, contact local emergency services (1122 in Pakistan) or go to the nearest emergency department.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Your account</h2>
        <p>
          You need an account to book. Keep your password to yourself and tell us if you think someone else is using it. You must give a name and phone number the doctor can use to reach you. You are responsible for information you enter about yourself or about someone you are allowed to book for.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Payments and refunds</h2>
        <p>
          Consultation fees are paid by bank transfer to the account shown in My care. Refunds are described on the <Link href="/refund">refund page</Link>. A booking is confirmed once we can match your transfer, or immediately when no fee is due.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Acceptable use</h2>
        <p>
          Do not misuse the service: no false identities, no attempts to read another person&apos;s record, no interference with the site, and no use of the AI tools to produce harmful or unlawful content. We can suspend an account that breaks these terms or that we reasonably believe is unsafe.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Liability</h2>
        <p>
          Clinical decisions are the doctor&apos;s. We provide the platform with reasonable care. Nothing in these terms excludes liability for death or personal injury caused by negligence, for fraud, or for anything else that the law of England and Wales does not allow us to exclude. These terms are governed by the law of England and Wales.
        </p>
      </section>
    </LegalPage>
  );
}
