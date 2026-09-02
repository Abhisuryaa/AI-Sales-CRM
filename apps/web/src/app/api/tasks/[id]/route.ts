import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { taskUpdateSchema } from "@/lib/schemas";
import { assertCanMutate } from "@/lib/ownership";

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  completedAt: true,
  dealId: true,
  deal: { select: { id: true, title: true } },
  contactId: true,
  contact: { select: { id: true, firstName: true, lastName: true } },
  companyId: true,
  company: { select: { id: true, name: true } },
  assigneeId: true,
  assignee: { select: { id: true, name: true, email: true } },
  createdById: true,
  creator: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const task = await db.task.findUnique({ where: { id }, select: taskSelect });
    if (!task) return json({ error: "Task not found" }, 404);

    return json(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    await assertCanMutate(session, "task", id);
    const body = await parseBody(req, taskUpdateSchema);

    const before = await db.task.findUnique({ where: { id } });
    if (!before) return json({ error: "Task not found" }, 404);

    const statusChanged = body.status !== undefined && body.status !== before.status;

    const task = await db.task.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
        ...(body.dealId !== undefined ? { dealId: body.dealId } : {}),
        ...(body.contactId !== undefined ? { contactId: body.contactId } : {}),
        ...(body.companyId !== undefined ? { companyId: body.companyId } : {}),
        ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
        ...(body.status !== undefined
          ? {
              status: body.status,
              completedAt: body.status === "DONE" ? (before.completedAt ?? new Date()) : null,
            }
          : {}),
      },
      select: taskSelect,
    });

    await writeAudit({
      actorId: session.user.id,
      action: statusChanged ? "task.status_change" : "task.update",
      entityType: "Task",
      entityId: id,
      before: { title: before.title, status: before.status, priority: before.priority },
      after: { title: task.title, status: task.status, priority: task.priority },
      ...requestMeta(req),
    });

    return json(task);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    await assertCanMutate(session, "task", id);

    const before = await db.task.findUnique({ where: { id } });
    if (!before) return json({ error: "Task not found" }, 404);

    await db.task.delete({ where: { id } });

    await writeAudit({
      actorId: session.user.id,
      action: "task.delete",
      entityType: "Task",
      entityId: id,
      before: { title: before.title, status: before.status },
      ...requestMeta(req),
    });

    return json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
