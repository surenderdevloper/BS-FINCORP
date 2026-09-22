import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { CustomerDocument } from "@/models/CustomerDocument";
import { readSession } from "@/lib/auth";
import { listCustomerDocuments, toDocumentMeta, validateDocumentUpload, type CustomerDocumentDoc } from "@/lib/customerDocuments";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await dbConnect();

  const customer = await Customer.findById(id).lean();
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const documents = await listCustomerDocuments(id);
  return NextResponse.json({ documents });
}

export async function POST(req: Request, ctx: RouteContext) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  await dbConnect();

  const customer = await Customer.findById(id).lean();
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });

  const b = body as { documentType?: unknown; originalFileName?: unknown; data?: unknown; description?: unknown };
  const validated = validateDocumentUpload({
    documentType: String(b.documentType ?? ""),
    originalFileName: String(b.originalFileName ?? ""),
    data: typeof b.data === "string" ? b.data : "",
    description: typeof b.description === "string" ? b.description : "",
  });

  if (!validated.ok) {
    const firstError = Object.values(validated.errors)[0] ?? "Invalid upload.";
    return NextResponse.json({ error: firstError, fieldErrors: validated.errors }, { status: 400 });
  }

  const doc = await CustomerDocument.create({
    customerId: customer._id,
    documentType: validated.documentType,
    originalFileName: validated.originalFileName,
    mimeType: validated.mimeType,
    fileSize: validated.fileSize,
    data: validated.data,
    description: validated.description ?? "",
  });

  return NextResponse.json(
    { document: toDocumentMeta(doc.toObject() as unknown as CustomerDocumentDoc) },
    { status: 201 }
  );
}