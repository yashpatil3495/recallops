import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOps — Incident Intelligence with Persistent Memory",
  description:
    "RecallOps remembers previous incidents, identifies recurring patterns, and recommends safer remediation actions based on historical outcomes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
