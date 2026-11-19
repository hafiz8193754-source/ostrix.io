import type { Metadata } from "next";

import { LegalContact } from "@/components/legal/LegalContact";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/lib/brand";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: `Refunds — ${BRAND.name}`,
  description: `When a bank-transfer consultation fee on ${BRAND.name} is refunded, and how to ask for one.`,
};

export default function RefundPage() {
  return (
    <LegalPage title="Refunds" updated="19 November 2026">
      <section className="flex flex-col gap-2">
        <h2>How you pay</h2>
        <p>
          Consultation fees on {BRAND.name} are paid by bank transfer. The account name, number, and reference are shown in My care after you book. We do not take card payments on the site.
        </p>
        <LegalContact />
      </section>
      <section className="flex flex-col gap-2">
        <h2>When you get a refund</h2>
        <ul>
          <li>You receive a full refund if the doctor cancels the appointment.</li>
          <li>You receive a full refund if the doctor does not join the visit.</li>
          <li>You receive a refund if you cancel at least 24 hours before the appointment time.</li>
          <li>A consultation that has been completed is not refunded.</li>
        </ul>
        <p>
          A completed consultation is one where you and the doctor connected for the visit, or the doctor finished the consultation and issued or declined a prescription after seeing you.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>How to ask</h2>
        <p>
          Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> from the address on your account. Include the appointment date, the doctor&apos;s name, and the bank-transfer reference. We reply by email and, where a refund is due, send it back to the account the transfer came from.
        </p>
      </section>
    </LegalPage>
  );
}
