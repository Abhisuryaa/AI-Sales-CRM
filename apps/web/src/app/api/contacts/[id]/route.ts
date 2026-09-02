import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { contactUpdateSchema } from "@/lib/schemas";
import { assertCanMutate } from "@/lib/ownership";

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

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const contact = await db.contact.findFirst({
      where: { id, deletedAt: null },
      select: contactSelect,
    });
    if (!contact) return json({ error: "Contact not found" }, 404);

    return json(contact);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    await assertCanMutate(session, "contact", id);
    const body = await parseBody(req, contactUpdateSchema);

    const before = await db.contact.findUnique({ where: { id } });
    if (!before || before.deletedAt) return json({ error: "Contact not found" }, 404);

    const contact = await db.contact.update({
      where: { id },
      data: {
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.linkedinUrl !== undefined ? { linkedinUrl: body.linkedinUrl } : {}),
        ...(body.companyId !== undefined ? { companyId: body.companyId } : {}),
        ...(body.ownerId !== undefined ? { ownerId: body.ownerId } : {}),
      },
      select: contactSelect,
    });

    await writeAudit({
      actorId: session.user.id,
      action: "contact.update",
      entityType: "Contact",
      entityId: id,
      before: { firstName: before.firstName, lastName: before.lastName },
      after: { firstName: contact.firstName, lastName: contact.lastName },
      ...requestMeta(req),
    });

    return json(contact);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    await assertCanMutate(session, "contact", id);

    const before = await db.contact.findUnique({ where: { id } });
    if (!before || before.deletedAt) return json({ error: "Contact not found" }, 404);

    await db.contact.update({ where: { id }, data: { deletedAt: new Date() } });

    await writeAudit({
      actorId: session.user.id,
      action: "contact.delete",
      entityType: "Contact",
      entityId: id,
      before: { firstName: before.firstName, lastName: before.lastName },
      ...requestMeta(req),
    });

    return json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
