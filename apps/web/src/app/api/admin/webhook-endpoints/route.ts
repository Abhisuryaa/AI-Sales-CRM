import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { webhookEndpointCreateSchema } from "@/lib/schemas";

export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const endpoints = await db.webhookEndpoint.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        secret: true,
        createdAt: true,
      },
    });

    return json({ data: endpoints });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN"]);
    const body = await parseBody(req, webhookEndpointCreateSchema);

    const endpoint = await db.webhookEndpoint.create({
      data: {
        url: body.url,
        events: body.events,
        secret: body.secret,
        isActive: body.isActive,
      },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        secret: true,
        createdAt: true,
      },
    });

    await writeAudit({
      actorId: session.user.id,
      action: "webhook_endpoint.create",
      entityType: "WebhookEndpoint",
      entityId: endpoint.id,
      after: { url: endpoint.url, events: endpoint.events },
      ...requestMeta(req),
    });

    return json(endpoint, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
