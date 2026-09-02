import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

type RouteCtx = { params: Promise<{ id: string }> };

const BLOCKING_STATUS: Record<string, true> = {
  RESEARCHING: true,
  ENRICHING: true,
  IDENTIFYING: true,
  QUALIFYING: true,
  DRAFTING: true,
};

/**
 * Proxies a pipeline run request to the agents service.
 * The agents service enforces single-active-run per lead (409 on conflict).
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    const lead = await db.lead.findUnique({
      where: { id },
      select: { id: true, companyName: true, status: true, createdById: true },
    });
    if (!lead) return json({ error: "Lead not found" }, 404);

    if (session.user.role === "SALES_REP" && lead.createdById !== session.user.id) {
      return json({ error: "You can only run pipelines on your own leads" }, 403);
    }

    if (lead.status === "CONVERTED") {
      return json({ error: "Lead is already converted" }, 409);
    }
    if (BLOCKING_STATUS[lead.status]) {
      return json({ error: "A pipeline run is already in progress for this lead" }, 409);
    }

    const agentsUrl = process.env.AGENTS_API_URL ?? "http://localhost:8000";
    const secret = process.env.WEBHOOK_SECRET ?? "";

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(`${agentsUrl}/pipeline/leads/${lead.id}/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-secret": secret,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      console.error("[leads/run] agents service unreachable", error);
      return json({ error: "Agents service is unavailable" }, 502);
    }

    if (upstreamResponse.status === 409) {
      return json({ error: "A pipeline run is already active for this lead" }, 409);
    }
    if (!upstreamResponse.ok) {
      const detail = await upstreamResponse.text().catch(() => "");
      console.error("[leads/run] upstream error", upstreamResponse.status, detail);
      return json({ error: `Agents service error (${upstreamResponse.status})` }, 502);
    }

    const payload = (await upstreamResponse.json().catch(() => ({}))) as {
      runId?: string;
    };

    await db.activity.create({
      data: {
        type: "AGENT_RUN",
        subject: `Pipeline run started for ${lead.companyName}`,
        dealId: null,
        actorId: session.user.id,
        meta: { leadId: lead.id, runId: payload.runId ?? null },
      },
    });

    await writeAudit({
      actorId: session.user.id,
      action: "lead.run",
      entityType: "Lead",
      entityId: lead.id,
      after: { runId: payload.runId ?? null },
      ...requestMeta(req),
    });

    return json({ runId: payload.runId ?? null }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
