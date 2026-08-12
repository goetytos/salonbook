import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Booking Terms",
  description: "Terms for using SalonBook booking and business tools.",
};

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
const operatorName = process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() || "SalonBook";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Using SalonBook"
      title="Booking Terms"
      summary="These pilot terms set an honest boundary between SalonBook’s scheduling service and the salon service delivered by each listed business."
    >
      <LegalSection title="The service">
        <p>{operatorName} provides software that lets customers view participating businesses, check services and availability, request appointments, and lets businesses manage their schedules. The salon or barber—not SalonBook—provides and is responsible for the booked beauty or grooming service.</p>
      </LegalSection>

      <LegalSection title="Appointments">
        <p>A booking is confirmed when SalonBook returns an appointment confirmation and reference. Customers must provide accurate contact information and arrive at the agreed time. The business may contact the customer about the appointment.</p>
        <p>Prices shown are supplied by the business. SalonBook currently records appointment value for scheduling and reporting; it does not collect deposits or settle payments. Payment is handled directly with the business unless a verified payment feature is explicitly shown in a later release.</p>
      </LegalSection>

      <LegalSection title="Cancellations and changes">
        <p>The business’s cancellation-notice window applies. Online rescheduling is not currently available. Customers should use the business contact shown on the profile or confirmation when they need help or the online cancellation window has closed.</p>
        <p>Each pilot business must publish any late-arrival, no-show, deposit or refund terms before those terms are enforced.</p>
      </LegalSection>

      <LegalSection title="Accounts and acceptable use">
        <p>Users must protect their login details and may not automate abusive requests, reserve slots without a genuine appointment intention, impersonate another person, probe other businesses’ data, upload unlawful material or disrupt the service.</p>
        <p>Business owners are responsible for accurate services, prices, opening hours, staff permissions, content rights and lawful use of customer records. An incomplete listing cannot be activated.</p>
      </LegalSection>

      <LegalSection title="Pilot limitations">
        <p>Features explicitly marked unavailable, disabled or not configured are not part of the service. In particular, M-Pesa deposits, WhatsApp delivery, subscription billing, password recovery, guest-booking claiming and online rescheduling must not be promised unless the production interface confirms they are enabled.</p>
        <p>During a guided pilot, planned maintenance and occasional defects may occur. SalonBook must keep a support and escalation route open and must not use a real business’s information publicly without authorization.</p>
      </LegalSection>

      <LegalSection title="Suspension and ending use">
        <p>SalonBook may suspend access to protect customers, businesses or the platform, or for serious breach of these terms. A business may request an export and closure process under its pilot agreement, subject to lawful retention obligations.</p>
      </LegalSection>

      <LegalSection title="Support and governing law">
        <p>{supportEmail ? <>Support requests can be sent to <a className="font-bold text-primary-700 hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</> : <strong>A support contact and final operator details must be configured before unattended real-customer use.</strong>}</p>
        <p>These terms are governed by the laws of Kenya. Nothing here removes a consumer right that cannot lawfully be excluded.</p>
      </LegalSection>
    </LegalPage>
  );
}
