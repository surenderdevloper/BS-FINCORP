import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { runForSession } from "@/lib/tenant";
import { getCompanySetting } from "@/models/CompanySetting";
import { generateCircleFaviconSvg } from "@/lib/favicon";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await readSession();
    let logo: string | null = null;

    if (session) {
      await dbConnect();
      const company = await runForSession(session.tenantId, () => getCompanySetting());
      logo = company?.logo ?? null;
    }

    const svg = generateCircleFaviconSvg(logo);
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    const defaultSvg = generateCircleFaviconSvg(null);
    return new NextResponse(defaultSvg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
}
