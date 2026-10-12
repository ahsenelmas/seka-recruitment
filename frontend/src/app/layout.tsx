import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEKA — Panel rekrutacji",
  description: "System zarządzania rekrutacją — wersja demonstracyjna",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
