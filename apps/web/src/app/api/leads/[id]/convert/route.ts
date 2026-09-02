import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";

type RouteCtx = { params: Promise<{ id: string }> };

type QualificationShape = {
  dealValueEstimate?: unknown;
  recommendedAction?: unknown;
};

function readQualification(raw: unknown): QualificationShape {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as QualificationShape;
  }
  return {};
}

function readMakerName(raw: unknown): string | null {
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === "object") {
    const maker = raw[0] as { name?: unknown };
    if (typeof maker.name === "string") return maker.name;
  }
  return null;
}

/**
 * Converts an APPROVED lead into Company + Contact + Deal (web-side conversion).
 * - Company from lead.companyName/domain/website/research-enrichment fields.
 * - Contact from lead contact fields (falling back to first decision maker).
 * - Deal at NEW stage; value from qualification.dealValueEstimate; owner = lead creator.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER", "SALES_REP"]);
    const { id } = await ctx.params;

    const lead = await db.lead.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });
    if (!lead) return json({ error: "Lead not found" }, 404);

    if (lead.status !== "APPROVED") {
      return json({ error: "Only APPROVED leads can be converted" }, 409);
    }
    const qualification = readQualification(lead.qualification);
    const dealValueEstimate = Number(qualification.dealValueEstimate);
    const dealValue = Number.isFinite(dealValueEstimate) && dealValueEstimate > 0 ? dealValueEstimate : 0;

    const result = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: lead.companyName,
          domain: lead.domain,
          website: lead.website,
          ownerId: lead.createdById,
        },
      });

      const contactFirstName =
        lead.contactFirstName ?? readMakerName(lead.decisionMakers)?.split(" ")[0] ?? "Unknown";
      const contactLastName =
        lead.contactLastName ?? readMakerName(lead.decisionMakers)?.split(" ").slice(1).join(" ") ?? "Contact";

      const contact = await tx.contact.create({
        data: {
          firstName: contactFirstName,
          lastName: contactLastName,
          email: lead.contactEmail,
          title: lead.contactTitle,
          companyId: company.id,
          ownerId: lead.createdById,
        },
      });

      const deal = await tx.deal.create({
        data: {
          title: `${lead.companyName} — new opportunity`,
          companyId: company.id,
          contactId: contact.id,
          stage: "NEW",
          status: "OPEN",
          value: dealValue,
          ownerId: lead.createdById,
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED",
          convertedCompanyId: company.id,
          convertedContactId: contact.id,
          convertedDealId: deal.id,
        },
      });

      await tx.activity.create({
        data: {
          type: "SYSTEM",
          subject: `Lead converted: ${lead.companyName}`,
          companyId: company.id,
          contactId: contact.id,
          dealId: deal.id,
          actorId: session.user.id,
          meta: { leadId: lead.id },
        },
      });

      return { company, contact, deal };
    });

    await writeAudit({
      actorId: session.user.id,
      action: "lead.convert",
      entityType: "Lead",
      entityId: lead.id,
      before: { status: lead.status },
      after: {
        status: "CONVERTED",
        companyId: result.company.id,
        contactId: result.contact.id,
        dealId: result.deal.id,
        dealValue,
      },
      ...requestMeta(req),
    });

    return json(
      {
        companyId: result.company.id,
        contactId: result.contact.id,
        dealId: result.deal.id,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
