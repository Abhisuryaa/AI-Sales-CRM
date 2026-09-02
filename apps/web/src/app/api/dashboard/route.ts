import { db } from "@/lib/db";
import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { decimalToNumber } from "@/lib/ownership";

const OPEN_STAGES = ["NEW", "QUALIFIED", "DISCOVERY", "PROPOSAL", "NEGOTIATION"] as const;

export async function GET() {
  try {
    await requireAuth();

    const [companies, contacts, deals, leads, tasks, recentActivities, won, lost] =
      await Promise.all([
        db.company.count({ where: { deletedAt: null } }),
        db.contact.count({ where: { deletedAt: null } }),
        db.deal.findMany({
          where: { deletedAt: null },
          select: { stage: true, status: true, value: true },
        }),
        db.lead.groupBy({ by: ["status"], _count: { _all: true } }),
        db.task.count({
          where: {
            status: { not: "DONE" },
            dueDate: { lte: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
          },
        }),
        db.activity.findMany({
          take: 10,
          orderBy: { occurredAt: "desc" },
          select: {
            id: true,
            type: true,
            subject: true,
            occurredAt: true,
            deal: { select: { id: true, title: true } },
            actor: { select: { id: true, name: true } },
          },
        }),
        db.deal.count({ where: { deletedAt: null, status: "WON" } }),
        db.deal.count({ where: { deletedAt: null, status: "LOST" } }),
      ]);

    const dealsByStage: Record<string, { count: number; value: number }> = {};
    for (const stage of OPEN_STAGES) dealsByStage[stage] = { count: 0, value: 0 };
    let openValue = 0;
    let openCount = 0;
    for (const deal of deals) {
      const value = decimalToNumber(deal.value);
      if (deal.status === "OPEN") {
        openCount += 1;
        openValue += value;
        const bucket = dealsByStage[deal.stage];
        if (bucket) {
          bucket.count += 1;
          bucket.value += value;
        }
      }
    }

    const closedCount = won + lost;
    const winRate = closedCount === 0 ? 0 : Math.round((won / closedCount) * 100);

    const leadsByStatus: Record<string, number> = {};
    for (const group of leads) {
      leadsByStatus[group.status] = group._count._all;
    }

    return json({
      counts: {
        companies,
        contacts,
        openDeals: openCount,
        pipelineValue: openValue,
        winRate,
        tasksDueSoon: tasks,
      },
      dealsByStage,
      leadsByStatus,
      recentActivities,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
