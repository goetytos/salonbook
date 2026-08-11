import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://salonbook-beta.vercel.app";
const description =
  "Find salons and barbershops across Kenya, compare services and reviews, and book an appointment online.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SalonBook | Salon appointments made simple",
    template: "%s | SalonBook",
  },
  description,
  applicationName: "SalonBook",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  keywords: [
    "salon booking Kenya",
    "barbershop appointments",
    "beauty appointments",
    "salon management",
  ],
  openGraph: {
    type: "website",
    locale: "en_KE",
    siteName: "SalonBook",
    title: "SalonBook | Salon appointments made simple",
    description,
  },
  twitter: {
    card: "summary",
    title: "SalonBook | Salon appointments made simple",
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f0e8",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-KE"
      className={`${manrope.variable} ${fraunces.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen bg-canvas text-dark-900 antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
