import { db } from "@/lib/db";
import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    await requireAuth();
    const { id } = await ctx.params;

    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        agentRuns: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            kind: true,
            status: true,
            currentStep: true,
            steps: true,
            error: true,
            provider: true,
            model: true,
            tokensUsed: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
          },
        },
        emails: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            subject: true,
            body: true,
            status: true,
            direction: true,
            approvedAt: true,
            createdAt: true,
          },
        },
        approvals: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { reviewer: { select: { id: true, name: true } } },
        },
        convertedCompany: { select: { id: true, name: true } },
        convertedContact: { select: { id: true, firstName: true, lastName: true } },
        convertedDeal: { select: { id: true, title: true } },
      },
    });

    if (!lead) return json({ error: "Lead not found" }, 404);

    return json(lead);
  } catch (error) {
    return handleApiError(error);
  }
}
