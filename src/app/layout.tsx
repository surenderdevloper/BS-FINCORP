import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appTitle = process.env.NEXT_PUBLIC_APP_NAME || "BS FINCORP";

export const metadata: Metadata = {
  title: {
    default: `${appTitle} | Loan Management`,
    template: `%s | ${appTitle}`,
  },
  description: `Loan management system for ${appTitle} microfinance business.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-zinc-900">{children}</body>
    </html>
  );
}