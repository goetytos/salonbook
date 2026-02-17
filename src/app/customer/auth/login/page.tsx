"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function CustomerLoginPage() {
  const router = useRouter();
  const { login } = useCustomerAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form.email, form.password);
      router.push("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SB</span>
            </div>
            <span className="text-xl font-bold text-dark-900">SalonBook</span>
          </Link>
          <h1 className="text-2xl font-bold text-dark-900">Customer Login</h1>
          <p className="text-dark-500 mt-1">Sign in to view your bookings</p>
        </div>

        <div className="bg-white rounded-xl border border-dark-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-dark-500 mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/customer/auth/signup" className="text-primary-600 font-medium hover:text-primary-700">
            Sign up
          </Link>
        </p>
        <p className="text-center text-sm text-dark-400 mt-2">
          Are you a salon owner?{" "}
          <Link href="/auth/login" className="text-primary-600 font-medium hover:text-primary-700">
            Owner login
          </Link>
        </p>
      </div>
    </div>
  );
}
