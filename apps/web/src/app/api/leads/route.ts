import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { leadCreateSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? undefined;
    const q = url.searchParams.get("q")?.trim();

    const leads = await db.lead.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(q ? { companyName: { contains: q, mode: "insensitive" } } : {}),
      },
      select: {
        id: true,
        companyName: true,
        domain: true,
        website: true,
        contactFirstName: true,
        contactLastName: true,
        contactEmail: true,
        contactTitle: true,
        source: true,
        status: true,
        tier: true,
        score: true,
        qualification: true,
        error: true,
        attempts: true,
        convertedCompanyId: true,
        createdById: true,
        creator: { select: { id: true, name: true, email: true } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return json({ data: leads });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const body = await parseBody(req, leadCreateSchema);

    const lead = await db.lead.create({
      data: {
        companyName: body.companyName,
        domain: body.domain ?? null,
        website: body.website ?? null,
        contactFirstName: body.contactFirstName ?? null,
        contactLastName: body.contactLastName ?? null,
        contactEmail: body.contactEmail ?? null,
        contactTitle: body.contactTitle ?? null,
        source: body.source,
        notes: body.notes ?? null,
        status: "NEW",
        createdById: session.user.id,
      },
      select: { id: true, companyName: true, status: true },
    });

    await writeAudit({
      actorId: session.user.id,
      action: "lead.create",
      entityType: "Lead",
      entityId: lead.id,
      after: { companyName: lead.companyName, source: body.source },
      ...requestMeta(req),
    });

    return json(lead, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
