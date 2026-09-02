import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { taskCreateSchema } from "@/lib/schemas";

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

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const assigneeId = url.searchParams.get("assigneeId") ?? undefined;

    const tasks = await db.task.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        // Non-admins see their own + unassigned tasks; admins see all.
        ...(session.user.role === "ADMIN"
          ? {}
          : { OR: [{ assigneeId: session.user.id }, { assigneeId: null }] }),
        ...(assigneeId ? { assigneeId } : {}),
      },
      select: taskSelect,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      take: 300,
    });

    return json({ data: tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const body = await parseBody(req, taskCreateSchema);

    const task = await db.task.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        priority: body.priority,
        dueDate: body.dueDate ?? null,
        dealId: body.dealId ?? null,
        contactId: body.contactId ?? null,
        companyId: body.companyId ?? null,
        assigneeId: body.assigneeId ?? session.user.id,
        createdById: session.user.id,
      },
      select: taskSelect,
    });

    await writeAudit({
      actorId: session.user.id,
      action: "task.create",
      entityType: "Task",
      entityId: task.id,
      after: { title: task.title, priority: task.priority, assigneeId: task.assigneeId },
      ...requestMeta(req),
    });

    return json(task, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
