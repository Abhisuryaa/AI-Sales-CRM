import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { adminUserUpdateSchema } from "@/lib/schemas";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN"]);
    const { id } = await ctx.params;
    const body = await parseBody(req, adminUserUpdateSchema);

    const before = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    if (!before) return json({ error: "User not found" }, 404);

    if (before.id === session.user.id && body.isActive === false) {
      return json({ error: "You cannot deactivate your own account" }, 409);
    }
    if (before.id === session.user.id && body.role && body.role !== "ADMIN") {
      return json({ error: "You cannot demote your own role" }, 409);
    }

    const user = await db.user.update({
      where: { id },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAudit({
      actorId: session.user.id,
      action: "user.update",
      entityType: "User",
      entityId: id,
      before: { role: before.role, isActive: before.isActive, name: before.name },
      after: { role: user.role, isActive: user.isActive, name: user.name },
      ...requestMeta(req),
    });

    return json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
