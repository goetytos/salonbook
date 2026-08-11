"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function CustomerLoginPage() {
  const router = useRouter();
  const { login } = useCustomerAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      router.push("/customer");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t sign you in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Customer account"
      title="Your appointments, all in one place."
      description="Sign in to see upcoming visits, manage bookings and share feedback after your appointment."
      panelEyebrow="Made for your next visit"
      panelTitle="Find the right studio. Keep every plan close."
      panelDescription="SalonBook brings discovery, booking details and visit history together without getting between you and the experience."
      highlights={["Return to upcoming appointments", "Discover studios across Nairobi", "Leave useful feedback after a visit"]}
      footer={
        <>
          <p>First time here? <Link href="/customer/auth/signup" className="font-bold text-primary-700 hover:underline">Create a customer account</Link></p>
          <p className="mt-1">Run a salon? <Link href="/auth/login" className="font-bold text-primary-700 hover:underline">Use business sign in</Link></p>
        </>
      }
    >
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading || undefined}>
        <Input label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoFocus />
        <Input label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        <Button type="submit" loading={loading} className="w-full">Sign in to my bookings</Button>
      </form>
    </AuthShell>
  );
}
