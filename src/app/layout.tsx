import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SalonBook – Appointment & Booking Platform",
  description:
    "Professional appointment booking platform for salons and barber shops in Kenya. Manage your business, accept bookings online.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-dark-900 min-h-screen">{children}</body>
    </html>
  );
}
