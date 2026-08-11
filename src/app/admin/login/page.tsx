"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth-context";
import AuthShell from "@/components/auth/AuthShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      router.push("/admin");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "We couldn’t verify these administrator credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Restricted access"
      title="Platform administration."
      description="Sign in with an authorised administrator account to review business access and platform activity."
      panelEyebrow="SalonBook operations"
      panelTitle="A calm control room for platform stewardship."
      panelDescription="Review business status, monitor activity and make deliberate access decisions from one protected workspace."
      highlights={["Review new business registrations", "Monitor platform-wide activity", "Manage business account status"]}
      footer={<p>Administrator access is limited to authorised platform operators.</p>}
    >
      {error && <p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading || undefined}>
        <Input label="Administrator email" type="email" inputMode="email" autoComplete="username" placeholder="admin@salonbook.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required autoFocus />
        <Input label="Password" type="password" autoComplete="current-password" placeholder="Enter administrator password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
        <Button type="submit" loading={loading} className="w-full">Sign in securely</Button>
      </form>
    </AuthShell>
  );
}
