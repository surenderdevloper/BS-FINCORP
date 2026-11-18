import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { dbConnect } from "@/lib/db";
import { readSession } from "@/lib/auth";
import { runForSession } from "@/lib/tenant";
import { getAppConfig } from "@/models/AppConfig";
import { brandStyleVars } from "@/lib/brand";
import { TopProgressBar } from "@/components/top-progress-bar";
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

const appTitle = process.env.NEXT_PUBLIC_APP_NAME || "Gigabyte Brothers";

export const metadata: Metadata = {
  title: {
    default: appTitle,
    template: `%s | ${appTitle}`,
  },
  description:
    "Loan and EMI management software — customers, loans, collections, receipts and reports in one app.",
  icons: {
    icon: "/api/favicon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const THEME_CACHE_TTL_MS = 60_000;
const themeCache = new Map<string, { style: CSSProperties; at: number }>();

/**
 * Read the developer theme/document colours and turn them into CSS custom
 * properties placed on <html>. Falls back to the built-in defaults if the
 * database is unreachable so the app always renders.
 */
async function themeStyle(): Promise<CSSProperties> {
  try {
    const session = await readSession();
    const cacheKey = session?.tenantId || "public";
    const cached = themeCache.get(cacheKey);
    if (cached && Date.now() - cached.at < THEME_CACHE_TTL_MS) {
      return cached.style;
    }

    await dbConnect();
    const config = await runForSession(session?.tenantId, () => getAppConfig());
    const docs = config.documents;
    const style: CSSProperties = {
      ...brandStyleVars(config.theme?.primary || "#059669"),
      "--print-letterhead": docs?.letterheadColor || "#1e40af",
      "--print-accent": docs?.accentColor || "#1e40af",
      "--print-text": docs?.textColor || "#18181b",
    } as CSSProperties;

    themeCache.set(cacheKey, { style, at: Date.now() });
    return style;
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
      <body className="min-h-full font-sans text-zinc-900">
        <TopProgressBar />
        {children}
      </body>
    </html>
  );
}