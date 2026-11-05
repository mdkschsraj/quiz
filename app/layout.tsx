import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hind_Siliguri } from "next/font/google";

// Hind Siliguri covers Bangla and Latin; Bricolage Grotesque gives the score and headlines a voice.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Hind_Siliguri({ subsets: ["bengali", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "College Quiz Challenge",
  description: "Take the quiz and enter the weekly raffle.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
