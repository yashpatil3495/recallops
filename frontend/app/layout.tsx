import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallOps - Incident Intelligence with Persistent Memory",
  description: "AI incident response agent recalling past incidents from Hindsight memory and Groq LLM reasoning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
