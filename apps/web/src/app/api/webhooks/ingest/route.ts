import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, json } from "@/lib/api";

const ingestSchema = z.object({
  companyName: z.string().min(1).max(200),
  domain: z.string().max(200).optional().nullable(),
  website: z.string().max(400).optional().nullable(),
  contactFirstName: z.string().max(100).optional().nullable(),
  contactLastName: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactTitle: z.string().max(120).optional().nullable(),
  source: z.string().max(40).optional(),
  notes: z.string().max(10000).optional().nullable(),
});

/**
 * Public webhook (auth bypassed via shared secret header).
 * Creates WebhookEvent + Lead (NEW), then fire-and-forget triggers the
 * agents pipeline. Responds 202 immediately.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.WEBHOOK_SECRET ?? "";
    const provided = req.headers.get("x-webhook-secret") ?? "";
    if (!secret || provided !== secret) {
      return json({ error: "Invalid webhook secret" }, 401);
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const body = ingestSchema.parse(raw);

    const event = await db.webhookEvent.create({
      data: {
        source: body.source === "n8n" ? "n8n" : "external",
        event: "lead.ingest",
        payload: body,
        signatureValid: true,
        status: "received",
      },
    });

    const lead = await db.lead.create({
      data: {
        companyName: body.companyName,
        domain: body.domain ?? null,
        website: body.website ?? null,
        contactFirstName: body.contactFirstName ?? null,
        contactLastName: body.contactLastName ?? null,
        contactEmail: body.contactEmail ?? null,
        contactTitle: body.contactTitle ?? null,
        notes: body.notes ?? null,
        source: "webhook",
        status: "NEW",
      },
    });

    await db.webhookEvent.update({
      where: { id: event.id },
      data: { status: "processed", resultLeadId: lead.id, processedAt: new Date() },
    });

    // Fire-and-forget: trigger the agents pipeline; response already sent on 202.
    const agentsUrl = process.env.AGENTS_API_URL ?? "http://localhost:8000";
    void fetch(`${agentsUrl}/pipeline/leads/${lead.id}/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": process.env.WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    }).catch((error) => {
      console.error("[webhooks/ingest] failed to trigger agents pipeline", error);
    });

    return json({ leadId: lead.id }, 202);
  } catch (error) {
    return handleApiError(error);
  }
}
