import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { dealCreateSchema } from "@/lib/schemas";

const dealSelect = {
  id: true,
  title: true,
  companyId: true,
  company: { select: { id: true, name: true } },
  contactId: true,
  contact: { select: { id: true, firstName: true, lastName: true } },
  stage: true,
  status: true,
  value: true,
  currency: true,
  probability: true,
  expectedCloseDate: true,
  closedAt: true,
  position: true,
  ownerId: true,
  owner: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const stage = url.searchParams.get("stage");
    const ownerId = url.searchParams.get("ownerId") ?? undefined;
    const q = url.searchParams.get("q")?.trim();

    const deals = await db.deal.findMany({
      where: {
        deletedAt: null,
        ...(stage ? { stage: stage as never } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      select: dealSelect,
      orderBy: [{ createdAt: "desc" }],
      take: 300,
    });

    return json({ data: deals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const body = await parseBody(req, dealCreateSchema);

    const company = await db.company.findFirst({
      where: { id: body.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!company) return json({ error: "Company not found" }, 404);

    const deal = await db.deal.create({
      data: {
        title: body.title,
        companyId: body.companyId,
        contactId: body.contactId ?? null,
        value: body.value,
        currency: body.currency,
        stage: body.stage,
        probability: body.probability ?? null,
        expectedCloseDate: body.expectedCloseDate ?? null,
        ownerId:
          session.user.role === "SALES_REP" || !body.ownerId ? session.user.id : body.ownerId,
      },
      select: dealSelect,
    });

    await db.activity.create({
      data: {
        type: "SYSTEM",
        subject: `Deal created: ${deal.title}`,
        dealId: deal.id,
        companyId: deal.companyId,
        actorId: session.user.id,
      },
    });

    await writeAudit({
      actorId: session.user.id,
      action: "deal.create",
      entityType: "Deal",
      entityId: deal.id,
      after: { title: deal.title, stage: deal.stage, value: deal.value },
      ...requestMeta(req),
    });

    return json(deal, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
