"use client";

import { CustomerAuthProvider } from "@/lib/customer-auth-context";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerAuthProvider>{children}</CustomerAuthProvider>;
}
