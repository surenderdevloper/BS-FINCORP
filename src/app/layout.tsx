import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { dbConnect } from "@/lib/db";
import { getAppConfig } from "@/models/AppConfig";
import { brandStyleVars } from "@/lib/brand";
import "./globals.css";

// The root layout reads developer configuration (theme + document colours) for
// every request, so the tree must be rendered dynamically rather than frozen at
// build time (which would also mean reaching the database during a build).
export const dynamic = "force-dynamic";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Read the developer theme/document colours and turn them into CSS custom
 * properties placed on <html>. Falls back to the built-in defaults if the
 * database is unreachable so the app always renders.
 */
async function themeStyle(): Promise<CSSProperties> {
  try {
    await dbConnect();
    const config = await getAppConfig();
    const docs = config.documents;
    return {
      ...brandStyleVars(config.theme?.primary || "#059669"),
      "--print-letterhead": docs?.letterheadColor || "#1e40af",
      "--print-accent": docs?.accentColor || "#1e40af",
      "--print-text": docs?.textColor || "#18181b",
    } as CSSProperties;
  } catch {
    return {} as CSSProperties;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const style = await themeStyle();
  return (
    <html
      lang="en"
      style={style}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-zinc-900">{children}</body>
    </html>
  );
}