import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { noteCreateSchema } from "@/lib/schemas";

const noteSelect = {
  id: true,
  body: true,
  companyId: true,
  company: { select: { id: true, name: true } },
  contactId: true,
  contact: { select: { id: true, firstName: true, lastName: true } },
  dealId: true,
  deal: { select: { id: true, title: true } },
  authorId: true,
  author: { select: { id: true, name: true, email: true } },
  createdAt: true,
} as const;

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const dealId = url.searchParams.get("dealId") ?? undefined;
    const contactId = url.searchParams.get("contactId") ?? undefined;
    const companyId = url.searchParams.get("companyId") ?? undefined;

    const notes = await db.note.findMany({
      where: {
        ...(dealId ? { dealId } : {}),
        ...(contactId ? { contactId } : {}),
        ...(companyId ? { companyId } : {}),
      },
      select: noteSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return json({ data: notes });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const body = await parseBody(req, noteCreateSchema);

    if (!body.companyId && !body.contactId && !body.dealId) {
      return json({ error: "A note must reference a company, contact, or deal" }, 400);
    }

    const note = await db.note.create({
      data: {
        body: body.body,
        companyId: body.companyId ?? null,
        contactId: body.contactId ?? null,
        dealId: body.dealId ?? null,
        authorId: session.user.id,
      },
      select: noteSelect,
    });

    await db.activity.create({
      data: {
        type: "NOTE",
        subject: `Note added${body.dealId ? " on deal" : body.contactId ? " on contact" : " on company"}`,
        body: note.body,
        dealId: note.dealId,
        contactId: note.contactId,
        companyId: note.companyId,
        actorId: session.user.id,
      },
    });

    await writeAudit({
      actorId: session.user.id,
      action: "note.create",
      entityType: "Note",
      entityId: note.id,
      after: { body: note.body.slice(0, 200), dealId: note.dealId, contactId: note.contactId, companyId: note.companyId },
      ...requestMeta(req),
    });

    return json(note, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
