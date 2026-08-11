"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function CustomerSignupPage() {
  const router = useRouter();
  const { signup } = useCustomerAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
      router.push("/customer");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Make the next booking simpler."
      description="Save your details once, keep track of appointments and return to studios you enjoyed."
      panelEyebrow="Your personal booking desk"
      panelTitle="Less searching through messages. More time for the visit."
      panelDescription="A SalonBook account keeps the useful details together before, during and after every appointment."
      highlights={["See upcoming and past bookings", "Cancel eligible appointments", "Rate completed visits"]}
      footer={
        <>
          <p>Already have an account? <Link href="/customer/auth/login" className="font-bold text-primary-700 hover:underline">Sign in</Link></p>
          <p className="mt-1">Joining as a business? <Link href="/auth/signup" className="font-bold text-primary-700 hover:underline">Create a business account</Link></p>
        </>
      }
    >
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading || undefined}>
        <Input label="Full name" autoComplete="name" placeholder="e.g. Akinyi Wambui" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoFocus />
        <Input label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <Input label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} />
        <Input label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXX" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
        <Button type="submit" loading={loading} className="w-full">Create customer account</Button>
      </form>
    </AuthShell>
  );
}
