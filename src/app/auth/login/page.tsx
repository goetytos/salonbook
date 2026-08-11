"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t sign you in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Business account"
      title="Welcome back to your studio."
      description="Sign in to manage the day’s appointments, your team and every customer detail."
      panelEyebrow="For salon teams"
      panelTitle="Your front desk, without the front-desk noise."
      panelDescription="Keep bookings moving while the experience stays personal—from the first service choice to the next visit."
      highlights={["See today’s schedule at a glance", "Keep staff availability accurate", "Remember the details customers value"]}
      footer={
        <>
          <p>New to SalonBook? <Link href="/auth/signup" className="font-bold text-primary-700 hover:underline">Create a business account</Link></p>
          <p className="mt-1">Booking for yourself? <Link href="/customer/auth/login" className="font-bold text-primary-700 hover:underline">Use customer sign in</Link></p>
        </>
      }
    >
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading || undefined}>
        <Input
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        <Button type="submit" loading={loading} className="w-full">Sign in to dashboard</Button>
      </form>
    </AuthShell>
  );
}
