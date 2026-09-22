import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { CustomerDocument } from "@/models/CustomerDocument";
import { readSession } from "@/lib/auth";
import { findOwnedDocument, toDocumentMeta } from "@/lib/customerDocuments";

type RouteContext = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, documentId } = await ctx.params;
  await dbConnect();

  const customer = await Customer.findById(id).lean();
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const doc = await findOwnedDocument(id, documentId);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  return NextResponse.json({ document: toDocumentMeta(doc) });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, documentId } = await ctx.params;
  await dbConnect();

  const customer = await Customer.findById(id).lean();
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const doc = await findOwnedDocument(id, documentId);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  // The file bytes live inside the same record (embedded-storage architecture),
  // so deleting the record deletes the file atomically — no separate storage to
  // fail out of sync with.
  const result = await CustomerDocument.deleteOne({
    _id: doc._id,
    customerId: id,
  });

  if (result.deletedCount !== 1) {
    return NextResponse.json({ error: "Delete failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedId: documentId });
}