"use client";

import { useState } from "react";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t create the business account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Open your workspace"
      title="Give your studio a better booking rhythm."
      description="Add the essentials now. You can refine services, staff and opening hours from the dashboard."
      panelEyebrow="A considered start"
      panelTitle="Turn enquiries into a schedule customers can trust."
      panelDescription="Create a clear home for your services and make each appointment easier to choose, book and manage."
      highlights={["A shareable booking page", "One view for bookings and customers", "Flexible services, staff and availability"]}
      footer={<p>Already have a business account? <Link href="/auth/login" className="font-bold text-primary-700 hover:underline">Sign in</Link></p>}
    >
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading || undefined}>
        <Input label="Business name" autoComplete="organization" placeholder="e.g. Kinyozi House" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required autoFocus />
        <Input label="Email address" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
        <Input label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Phone number" type="tel" inputMode="tel" autoComplete="tel" placeholder="07XXXXXXXX" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <Input label="Location" autoComplete="address-level2" placeholder="e.g. Westlands, Nairobi" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required />
        </div>
        <Button type="submit" loading={loading} className="w-full">Create business account</Button>
      </form>
    </AuthShell>
  );
}
