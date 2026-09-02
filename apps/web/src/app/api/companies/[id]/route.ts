import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { companyUpdateSchema } from "@/lib/schemas";
import { assertCanMutate } from "@/lib/ownership";

const companySelect = {
  id: true,
  name: true,
  domain: true,
  website: true,
  industry: true,
  employeeCount: true,
  hqLocation: true,
  linkedinUrl: true,
  description: true,
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

    const company = await db.company.findFirst({
      where: { id, deletedAt: null },
      select: companySelect,
    });
    if (!company) return json({ error: "Company not found" }, 404);

    return json(company);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    await assertCanMutate(session, "company", id);
    const body = await parseBody(req, companyUpdateSchema);

    const before = await db.company.findUnique({ where: { id } });
    if (!before || before.deletedAt) return json({ error: "Company not found" }, 404);

    const company = await db.company.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.domain !== undefined ? { domain: body.domain } : {}),
        ...(body.website !== undefined ? { website: body.website } : {}),
        ...(body.industry !== undefined ? { industry: body.industry } : {}),
        ...(body.employeeCount !== undefined ? { employeeCount: body.employeeCount } : {}),
        ...(body.hqLocation !== undefined ? { hqLocation: body.hqLocation } : {}),
        ...(body.linkedinUrl !== undefined ? { linkedinUrl: body.linkedinUrl } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.ownerId !== undefined ? { ownerId: body.ownerId } : {}),
      },
      select: companySelect,
    });

    await writeAudit({
      actorId: session.user.id,
      action: "company.update",
      entityType: "Company",
      entityId: id,
      before: { name: before.name, ownerId: before.ownerId },
      after: { name: company.name, ownerId: company.ownerId },
      ...requestMeta(req),
    });

    return json(company);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    await assertCanMutate(session, "company", id);

    const before = await db.company.findUnique({ where: { id } });
    if (!before || before.deletedAt) return json({ error: "Company not found" }, 404);

    await db.company.update({ where: { id }, data: { deletedAt: new Date() } });

    await writeAudit({
      actorId: session.user.id,
      action: "company.delete",
      entityType: "Company",
      entityId: id,
      before: { name: before.name, ownerId: before.ownerId },
      ...requestMeta(req),
    });

    return json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
