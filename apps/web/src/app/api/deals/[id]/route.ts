import { $Enums, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { dealUpdateSchema } from "@/lib/schemas";
import { assertCanMutate, decimalToNumber } from "@/lib/ownership";

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

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const deal = await db.deal.findFirst({
      where: { id, deletedAt: null },
      select: dealSelect,
    });
    if (!deal) return json({ error: "Deal not found" }, 404);

    return json({ ...deal, value: decimalToNumber(deal.value) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    const existing = await db.deal.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return json({ error: "Deal not found" }, 404);

    const body = await parseBody(req, dealUpdateSchema);

    if (session.user.role === "VIEWER") return json({ error: "Forbidden" }, 403);

    const stageChanged = body.stage !== undefined && body.stage !== existing.stage;

    if (session.user.role === "SALES_REP") {
      // SALES_REP may only mutate their own deals.
      if (existing.ownerId !== session.user.id) {
        return json({ error: "You can only modify your own deals" }, 403);
      }
      // SALES_REP may not reassign ownership to someone else.
      if (body.ownerId !== undefined && body.ownerId !== session.user.id) {
        return json({ error: "You cannot reassign deal ownership" }, 403);
      }
      void stageChanged;
    }

    const stageStatusMap: Record<$Enums.DealStage, $Enums.DealStatus> = {
      NEW: "OPEN",
      QUALIFIED: "OPEN",
      DISCOVERY: "OPEN",
      PROPOSAL: "OPEN",
      NEGOTIATION: "OPEN",
      WON: "WON",
      LOST: "LOST",
    };

    const updateData: Prisma.DealUpdateInput = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.companyId !== undefined
        ? { company: { connect: { id: body.companyId } } }
        : {}),
      ...(body.contactId !== undefined
        ? body.contactId === null
          ? { contact: { disconnect: true } }
          : { contact: { connect: { id: body.contactId } } }
        : {}),
      ...(body.value !== undefined ? { value: body.value } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.probability !== undefined ? { probability: body.probability } : {}),
      ...(body.expectedCloseDate !== undefined
        ? { expectedCloseDate: body.expectedCloseDate }
        : {}),
      ...(body.ownerId !== undefined
        ? body.ownerId === null
          ? { owner: { disconnect: true } }
          : { owner: { connect: { id: body.ownerId } } }
        : {}),
    };

    if (stageChanged && body.stage !== undefined) {
      const stage = body.stage;
      updateData.stage = stage;
      updateData.status = stageStatusMap[stage];
      updateData.closedAt = stage === "WON" || stage === "LOST" ? new Date() : null;
    }

    const deal = await db.deal.update({
      where: { id },
      data: updateData,
      select: dealSelect,
    });

    if (stageChanged && body.stage !== undefined) {
      const stage = body.stage;
      await db.activity.create({
        data: {
          type: "STAGE_CHANGE",
          subject: `Stage changed: ${existing.stage} → ${stage}`,
          dealId: deal.id,
          companyId: deal.companyId,
          actorId: session.user.id,
          meta: { from: existing.stage, to: stage },
        },
      });
    }

    await writeAudit({
      actorId: session.user.id,
      action: stageChanged ? "deal.stage_change" : "deal.update",
      entityType: "Deal",
      entityId: id,
      before: {
        title: existing.title,
        stage: existing.stage,
        status: existing.status,
        value: existing.value.toString(),
      },
      after: {
        title: deal.title,
        stage: deal.stage,
        status: deal.status,
        value: deal.value.toString(),
      },
      ...requestMeta(req),
    });

    return json({ ...deal, value: decimalToNumber(deal.value) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    await assertCanMutate(session, "deal", id);

    const before = await db.deal.findUnique({ where: { id } });
    if (!before || before.deletedAt) return json({ error: "Deal not found" }, 404);

    await db.deal.update({ where: { id }, data: { deletedAt: new Date() } });

    await writeAudit({
      actorId: session.user.id,
      action: "deal.delete",
      entityType: "Deal",
      entityId: id,
      before: { title: before.title, stage: before.stage },
      ...requestMeta(req),
    });

    return json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
