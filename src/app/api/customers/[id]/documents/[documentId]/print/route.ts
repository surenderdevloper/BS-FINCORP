import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { readSession } from "@/lib/auth";
import { findOwnedDocument, sanitizeFileName } from "@/lib/customerDocuments";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return new Response("Unauthorized", { status: 401, headers: { "Content-Type": "text/plain" } });

  const { id, documentId } = await ctx.params;
  await dbConnect();

  const customer = await Customer.findById(id).lean();
  if (!customer) return new Response("Customer not found.", { status: 404, headers: { "Content-Type": "text/plain" } });

  const doc = await findOwnedDocument(id, documentId);
  if (!doc) return new Response("Document not found.", { status: 404, headers: { "Content-Type": "text/plain" } });

  const title = escapeHtml(sanitizeFileName(doc.originalFileName));

  // PDFs get printed from the browser's native PDF viewer via the file route.
  // This print page only renders images cleanly.
  if (!doc.mimeType.startsWith("image/")) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Print — ${title}</title></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center;color:#18181b">
<p>This document is a PDF. Open it in the viewer (View) and print it from the browser&rsquo;s PDF window.</p>
</body></html>`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const fileUrl = `/api/customers/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/file`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Print — ${title}</title>
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; }
  img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
  @media print { body { margin: 0; padding: 0; } }
</style></head>
<body>
<img src="${escapeHtml(fileUrl)}" alt="Document" onload="window.print()" />
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}