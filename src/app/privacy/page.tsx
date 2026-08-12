import type { Metadata } from "next";
import LegalPage, { LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "How SalonBook handles account and appointment information.",
};

const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim();
const operatorName = process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() || "SalonBook";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Your information"
      title="Privacy Notice"
      summary="This notice explains what SalonBook collects, why it is needed, where it is processed and the choices available to customers and businesses."
    >
      <LegalSection title="Who is responsible">
        <p>{operatorName} operates the SalonBook platform. A listed salon controls how it uses its own customer records; SalonBook processes those records to provide booking and business-management services and also controls platform account, security and service-operation information.</p>
        <p>{privacyEmail ? <>Privacy questions and rights requests can be sent to <a className="font-bold text-primary-700 hover:underline" href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.</> : <strong>A dedicated privacy contact must be published before SalonBook accepts bookings from a real pilot business. Until then, the platform is limited to controlled demonstrations with synthetic data.</strong>}</p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <p>For customer bookings, SalonBook collects the customer’s name, Kenyan phone number, chosen business, service, staff member where selected, appointment date and time, optional booking note, promotion and booking status.</p>
        <p>For customer, business-owner and administrator accounts, SalonBook also processes contact details, authentication data, account status and activity required to operate and secure the service. Businesses may add staff, services, hours, customer notes, promotions and public profile information.</p>
        <p>Do not put health information, identity-document numbers, passwords, M-Pesa PINs or card details in booking notes.</p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <p>Information is used to create and manage appointments, prevent double-booking, show availability, operate customer and business accounts, communicate service messages when a provider is enabled, investigate errors or misuse, provide support and meet legal obligations.</p>
        <p>SalonBook does not sell customer contact information. A salon receives the information needed to provide the appointment. Service providers receive only what is needed to host, secure or deliver the requested service.</p>
      </LegalSection>

      <LegalSection title="Storage and overseas processing">
        <p>The application currently uses Vercel for web hosting and a Supabase PostgreSQL project in the European Union (eu-west-1). This means information can be processed outside Kenya. Before a real-business pilot, SalonBook must document the applicable transfer safeguard and sign the required data-processing terms with each salon and provider.</p>
      </LegalSection>

      <LegalSection title="Retention, security and backups">
        <p>SalonBook uses access controls, tenant-scoped queries, encrypted network connections and audit records to protect information. No online service can promise absolute security. A documented retention schedule, recurring off-site backup and tested restore must be in place before unattended real-customer use.</p>
        <p>Booking and account information is kept only as long as needed for the booking service, legitimate business records, security and legal requirements. Pilot agreements must state the exact retention period.</p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Subject to Kenyan law, a person may ask to be informed about use of their data, access it, correct inaccurate information, object to or restrict certain processing, and request deletion where retention is no longer justified. SalonBook will verify a requester before disclosing or changing information.</p>
        <p>A booking customer can also contact the salon shown on the booking page. Complaints may be raised with Kenya’s Office of the Data Protection Commissioner.</p>
      </LegalSection>

      <LegalSection title="Messages and marketing">
        <p>Appointment confirmations, cancellations and reminders are transactional messages. Marketing messages require a separate lawful basis and a clear way to opt out. SalonBook will not treat a booking as consent to unrelated marketing.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>Material changes to this notice will be published here with a new date. Businesses must be told when a change affects their processing instructions or agreement.</p>
      </LegalSection>
    </LegalPage>
  );
}
