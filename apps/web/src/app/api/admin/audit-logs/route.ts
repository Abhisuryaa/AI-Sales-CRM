import { db } from "@/lib/db";
import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    await requireAuth(["ADMIN"]);
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 500);

    const logs = await db.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        actorId: true,
        actor: { select: { id: true, name: true, email: true } },
        action: true,
        entityType: true,
        entityId: true,
        before: true,
        after: true,
        ip: true,
        createdAt: true,
      },
    });

    return json({ data: logs });
  } catch (error) {
    return handleApiError(error);
  }
}
