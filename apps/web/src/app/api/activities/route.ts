import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { activityCreateSchema } from "@/lib/schemas";

const activitySelect = {
  id: true,
  type: true,
  subject: true,
  body: true,
  occurredAt: true,
  companyId: true,
  company: { select: { id: true, name: true } },
  contactId: true,
  contact: { select: { id: true, firstName: true, lastName: true } },
  dealId: true,
  deal: { select: { id: true, title: true } },
  actorId: true,
  actor: { select: { id: true, name: true } },
  meta: true,
} as const;

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const dealId = url.searchParams.get("dealId") ?? undefined;
    const contactId = url.searchParams.get("contactId") ?? undefined;
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50") || 50, 200);

    const activities = await db.activity.findMany({
      where: {
        ...(dealId ? { dealId } : {}),
        ...(contactId ? { contactId } : {}),
        ...(companyId ? { companyId } : {}),
        ...(type ? { type: type as never } : {}),
      },
      select: activitySelect,
      orderBy: { occurredAt: "desc" },
      take: limit,
    });

    return json({ data: activities });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const body = await parseBody(req, activityCreateSchema);

    const activity = await db.activity.create({
      data: {
        type: body.type,
        subject: body.subject,
        body: body.body ?? null,
        companyId: body.companyId ?? null,
        contactId: body.contactId ?? null,
        dealId: body.dealId ?? null,
        actorId: session.user.id,
      },
      select: activitySelect,
    });

    await writeAudit({
      actorId: session.user.id,
      action: "activity.create",
      entityType: "Activity",
      entityId: activity.id,
      after: { type: activity.type, subject: activity.subject },
      ...requestMeta(req),
    });

    return json(activity, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
