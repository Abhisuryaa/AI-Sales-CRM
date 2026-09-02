import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { contactCreateSchema } from "@/lib/schemas";

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  title: true,
  linkedinUrl: true,
  isDecisionMaker: true,
  decisionScore: true,
  companyId: true,
  company: { select: { id: true, name: true } },
  ownerId: true,
  owner: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const ownerId = url.searchParams.get("ownerId") ?? undefined;

    const contacts = await db.contact.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(companyId ? { companyId } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      select: contactSelect,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return json({ data: contacts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const body = await parseBody(req, contactCreateSchema);

    const contact = await db.contact.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email ?? null,
        phone: body.phone ?? null,
        title: body.title ?? null,
        linkedinUrl: body.linkedinUrl ?? null,
        companyId: body.companyId ?? null,
        ownerId:
          session.user.role === "SALES_REP" || !body.ownerId ? session.user.id : body.ownerId,
      },
      select: contactSelect,
    });

    await writeAudit({
      actorId: session.user.id,
      action: "contact.create",
      entityType: "Contact",
      entityId: contact.id,
      after: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        companyId: contact.companyId,
      },
      ...requestMeta(req),
    });

    return json(contact, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
