import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
