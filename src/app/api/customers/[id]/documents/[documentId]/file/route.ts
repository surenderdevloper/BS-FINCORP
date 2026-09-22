import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { readSession } from "@/lib/auth";
import { findOwnedDocument, parseDataUrl, sanitizeFileName } from "@/lib/customerDocuments";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, documentId } = await ctx.params;
  await dbConnect();

  const customer = await Customer.findById(id).lean();
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const doc = await findOwnedDocument(id, documentId);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const parsed = parseDataUrl(doc.data);
  if (!parsed) {
    return NextResponse.json({ error: "Document content is unavailable." }, { status: 409 });
  }

  const fileName = sanitizeFileName(doc.originalFileName);

  return new NextResponse(new Uint8Array(parsed.decoded), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(parsed.decoded.length),
      "Cache-Control": "private, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}