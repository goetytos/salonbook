"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SalonBackground from "@/components/ui/SalonBackground";
import { ScissorsIcon } from "@/components/icons/SalonIcons";

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left decorative panel */}
      <div className="relative bg-gradient-to-br from-primary-800 via-primary-700 to-primary-600 lg:w-[40%] lg:min-h-screen overflow-hidden">
        <SalonBackground variant="auth" />
        <div className="relative z-10 px-6 py-8 lg:py-0 lg:flex lg:flex-col lg:justify-center lg:h-full lg:px-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ScissorsIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SalonBook</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2 hidden lg:block">
            Welcome back
          </h2>
          <p className="text-primary-200 hidden lg:block">
            Sign in to manage your appointments and discover new salons near you.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-dark-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:text-left">
            <div className="w-12 h-1 bg-accent-400 rounded-full mb-4 mx-auto lg:mx-0" />
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
    </div>
  );
}
