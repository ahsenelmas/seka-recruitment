import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import DemoAccessBoundary from "@/components/DemoAccessBoundary";

export const metadata: Metadata = {
  title: "SEKA — Panel rekrutacji",
  description: "SEKA — centrum zarządzania rekrutacją",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" translate="no" className="notranslate">
      <head><meta name="google" content="notranslate" /></head>
      <body><Suspense fallback={<p className="empty-state">SEKA · Ładowanie / Loading…</p>}><DemoAccessBoundary>{children}</DemoAccessBoundary></Suspense></body>
    </html>
  );
}
