import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { companyCreateSchema } from "@/lib/schemas";

const companySelect = {
  id: true,
  name: true,
  domain: true,
  website: true,
  industry: true,
  employeeCount: true,
  hqLocation: true,
  linkedinUrl: true,
  description: true,
  ownerId: true,
  owner: { select: { id: true, name: true, email: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: Request) {
  try {
    await requireAuth();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const ownerId = url.searchParams.get("ownerId") ?? undefined;

    const companies = await db.company.findMany({
      where: {
        deletedAt: null,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      select: companySelect,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return json({ data: companies });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const body = await parseBody(req, companyCreateSchema);

    const data = {
      name: body.name,
      domain: body.domain ?? null,
      website: body.website ?? null,
      industry: body.industry ?? null,
      employeeCount: body.employeeCount ?? null,
      hqLocation: body.hqLocation ?? null,
      linkedinUrl: body.linkedinUrl ?? null,
      description: body.description ?? null,
      ownerId:
        session.user.role === "SALES_REP" || !body.ownerId ? session.user.id : body.ownerId,
    };

    const company = await db.company.create({
      data,
      select: companySelect,
    });

    await writeAudit({
      actorId: session.user.id,
      action: "company.create",
      entityType: "Company",
      entityId: company.id,
      after: { name: company.name, ownerId: company.ownerId },
      ...requestMeta(req),
    });

    return json(company, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
