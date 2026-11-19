import type { Metadata } from "next";

import { LegalContact } from "@/components/legal/LegalContact";
import { LegalPage } from "@/components/legal/LegalPage";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Privacy policy — ${BRAND.name}`,
  description: `How ${BRAND.name} uses account, booking, and health information under UK GDPR and the Data Protection Act 2018.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="19 November 2026">
      <section className="flex flex-col gap-2">
        <h2>Who we are</h2>
        <p>
          This policy explains how {BRAND.name} uses personal information when you create an account, check symptoms, book a doctor, join a visit, or receive a prescription. {BRAND.name} is the controller for that information.
        </p>
        <LegalContact />
      </section>
      <section className="flex flex-col gap-2">
        <h2>The information we use</h2>
        <ul>
          <li>Account details: name, email, password (stored by our auth provider), and the role you choose.</li>
          <li>Booking details: phone number, the time you picked, and payment references or receipts for a bank transfer.</li>
          <li>Health information you choose to share: symptoms, age, allergies, medicines, visit notes, call recordings where both people agreed, and prescriptions.</li>
          <li>Doctor application details, which are reviewed by our team and are not shown on the public doctor profile.</li>
          <li>Technical logs needed to run the site, including reminder delivery (the channel and whether it was sent).</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Health data</h2>
        <p>
          Symptoms, consultations, and prescriptions are health data. Under the UK GDPR and the Data Protection Act 2018 that is special category data, and we treat it as such. We use it to arrange and provide the consultation you asked for (UK GDPR Article 9(2)(h)) and because you give explicit consent when you submit symptoms and book (Article 9(2)(a)). You can withdraw that consent by closing the account or emailing us. Withdrawing consent does not undo care that has already been given.
        </p>
        <p>
          Ordinary account and booking data is used to perform the contract with you (Article 6(1)(b)), to meet a legal duty where one applies (Article 6(1)(c)), and to keep the service secure (Article 6(1)(f)).
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>AI is not a diagnosis</h2>
        <p>
          The symptom check and draft notes use AI to organise what you typed or said, and to prepare material for the doctor. That output is not a diagnosis, not a prescription, and not medical advice. Your doctor reviews the visit and is the only person who can sign a prescription.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Who else handles it</h2>
        <p>We use these processors to run the service. They handle information only on our instructions:</p>
        <ul>
          <li>Supabase — accounts, the database, and stored files.</li>
          <li>Vercel — hosting the website and API.</li>
          <li>xAI — symptom organisation and speech-to-text when you use those features.</li>
          <li>Twilio — phone and video-call connections, and appointment reminders by WhatsApp or, if WhatsApp is not set up, by SMS.</li>
        </ul>
        <p>
          Your doctor sees the information needed for your visit. We do not sell personal information. Some of these providers store or process data outside the United Kingdom. Where that happens we rely on the transfer tools they provide, such as the UK International Data Transfer Agreement or an adequacy decision, as applicable.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>How long we keep it</h2>
        <p>
          Account details stay while the account is open. You can delete the account in settings, or ask us by email. Consultation records, prescriptions, and booking details are kept so you and your doctor can refer back to the care, and for as long as we need them to deal with a complaint, a refund, or a legal claim. Reminder logs stay with the appointment. Bank-transfer receipts are kept with the payment record. We do not store card numbers.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Your rights</h2>
        <p>
          You can ask for a copy of your information, a correction, deletion, a restriction, or a portable copy, and you can object to processing based on legitimate interests. Email us and we will respond within one month. You can also complain to the Information Commissioner&apos;s Office at ico.org.uk.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2>Emergencies</h2>
        <p>
          {BRAND.name} is not an emergency service. If you may need urgent help, contact your local emergency number (1122 in Pakistan) or go to the nearest emergency department. Do not wait for a message in the app.
        </p>
      </section>
    </LegalPage>
  );
}
