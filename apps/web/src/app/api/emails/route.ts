import { db } from "@/lib/db";
import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

export async function GET(req: Request) {
  try {
    await requireAuth(["ADMIN", "MANAGER"]);
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "pending_approval";

    const emails = await db.emailMessage.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        leadId: true,
        lead: { select: { id: true, companyName: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        direction: true,
        status: true,
        subject: true,
        body: true,
        createdAt: true,
      },
    });

    return json({ data: emails });
  } catch (error) {
    return handleApiError(error);
  }
}
