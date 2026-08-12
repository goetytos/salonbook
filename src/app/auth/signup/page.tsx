"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", location: "" });
  const [invitation, setInvitation] = useState<{ token: string; email: string } | null>(null);
  const [checkingInvitation, setCheckingInvitation] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  useEffect(() => {
    // Admin-generated links use a fragment so the bearer token never reaches
    // HTTP logs or Referer headers. Query-string capabilities are deliberately
    // ignored, and the accepted fragment is removed from browser history.
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = (fragment.get("invite") || "").trim();
    const email = (fragment.get("email") || "").trim().toLowerCase();

    if (token) {
      setInvitation({ token, email });
      if (email) setForm((current) => ({ ...current, email }));
      window.history.replaceState(null, "", window.location.pathname);
    }
    setCheckingInvitation(false);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!invitation) throw new Error("A valid business invitation is required.");
      await signup({ ...form, invitation_token: invitation.token });
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t create the business account.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingInvitation) {
    return (
      <AuthShell
        eyebrow="Pilot invitation"
        title="Checking your invitation…"
        description="SalonBook business onboarding is currently limited to invited pilot partners."
        panelEyebrow="A controlled start"
        panelTitle="Bring the first studios on carefully."
        panelDescription="Invitation-only onboarding keeps every listing reviewed before it reaches customers."
      >
        <p className="text-sm text-dark-500" role="status">Preparing secure signup…</p>
      </AuthShell>
    );
  }

  if (!invitation) {
    return (
      <AuthShell
        eyebrow="Invitation-only pilot"
        title="Business signup is not open to the public yet."
        description="We are onboarding the first Kenyan salons one at a time so every schedule, service and public listing is checked before launch."
        panelEyebrow="A guided pilot"
        panelTitle="Start with a booking setup you can trust."
        panelDescription="Each invited studio gets a private setup period, a preview and an administrator review before customers can book."
        highlights={["Private listing setup", "Readiness review before activation", "A guided first-business pilot"]}
        footer={<p>Already invited and registered? <Link href="/auth/login" className="font-bold text-primary-700 hover:underline">Sign in</Link></p>}
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-bold">You need a one-time SalonBook invitation link.</p>
          {supportEmail ? (
            <p className="mt-2">To discuss the pilot, email <a href={`mailto:${supportEmail}?subject=SalonBook%20pilot%20access`} className="font-bold text-primary-700 hover:underline">{supportEmail}</a>.</p>
          ) : (
            <p className="mt-2">Ask your SalonBook pilot contact for access. Public onboarding must remain closed until the operator configures a support address.</p>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Invited pilot partner"
      title="Set up your studio workspace."
      description="This one-time invitation is tied to your email. Add the essentials now, then complete services, staff and opening hours privately."
      panelEyebrow="A considered start"
      panelTitle="Turn enquiries into a schedule customers can trust."
      panelDescription="Create a clear home for your services and make each appointment easier to choose, book and manage."
      highlights={["A shareable booking page", "One view for bookings and customers", "Flexible services, staff and availability"]}
      footer={<p>Already have a business account? <Link href="/auth/login" className="font-bold text-primary-700 hover:underline">Sign in</Link></p>}
    >
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading || undefined}>
        <Input label="Business name" autoComplete="organization" placeholder="e.g. Kinyozi House" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoFocus />
        <Input label="Invited email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} readOnly={Boolean(invitation.email)} required />
        <Input label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXX" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <Input label="Location" autoComplete="address-level2" placeholder="e.g. Westlands, Nairobi" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required />
        </div>
        <Button type="submit" loading={loading} className="w-full">Accept invitation and create account</Button>
        <p className="text-xs leading-5 text-dark-500">By creating an account, you agree to the <Link href="/terms" className="font-semibold text-primary-700 hover:underline">Terms</Link> and acknowledge the <Link href="/privacy" className="font-semibold text-primary-700 hover:underline">Privacy Notice</Link>.</p>
      </form>
    </AuthShell>
  );
}
