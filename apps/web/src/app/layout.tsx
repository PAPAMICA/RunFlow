import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RunFlow",
  description: "API-first job automation platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
