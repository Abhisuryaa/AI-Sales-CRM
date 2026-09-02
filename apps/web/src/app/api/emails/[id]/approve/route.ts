import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { emailDecisionSchema } from "@/lib/schemas";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * MANAGER/ADMIN-only decision on a pending-approval email.
 * decision=approved → email approved, lead APPROVED, Approval approved.
 * decision=rejected → email rejected, lead REJECTED, Approval rejected.
 * decision=edited   → email subject/body updated + approved, lead APPROVED, Approval edited.
 * Writes Activity type=APPROVAL.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const session = await requireAuth(["ADMIN", "MANAGER"]);
    const { id } = await ctx.params;
    const body = await parseBody(req, emailDecisionSchema);

    const email = await db.emailMessage.findUnique({
      where: { id },
      include: { lead: { select: { id: true, companyName: true, status: true } } },
    });
    if (!email) return json({ error: "Email not found" }, 404);
    if (email.status !== "pending_approval") {
      return json({ error: `Email is not pending approval (status: ${email.status})` }, 409);
    }

    const decision = body.decision;
    const decidedAt = new Date();

    const [updatedEmail, lead] = await db.$transaction(async (tx) => {
      const updatedEmail = await tx.emailMessage.update({
        where: { id },
        data: {
          status: decision === "rejected" ? "failed" : "approved",
          subject: decision === "edited" && body.editedSubject ? body.editedSubject : email.subject,
          body: decision === "edited" && body.editedBody ? body.editedBody : email.body,
          approvedById: session.user.id,
          approvedAt: decidedAt,
        },
      });

      let leadStatus: string | null = null;
      if (email.leadId) {
        const nextLeadStatus = decision === "rejected" ? "REJECTED" : "APPROVED";
        await tx.lead.update({
          where: { id: email.leadId },
          data: { status: nextLeadStatus },
        });
        leadStatus = nextLeadStatus;

        await tx.approval.updateMany({
          where: { emailId: id, status: "pending" },
          data: {
            status: decision === "edited" ? "edited" : decision,
            reviewerId: session.user.id,
            feedback: body.feedback ?? null,
            decidedAt,
          },
        });
      }

      return [updatedEmail, leadStatus] as const;
    });

    if (email.leadId) {
      await db.activity.create({
        data: {
          type: "APPROVAL",
          subject: `Email ${decision}: ${updatedEmail.subject}`,
          body: body.feedback ?? null,
          actorId: session.user.id,
          meta: { emailId: updatedEmail.id, leadId: email.leadId, decision },
        },
      });
    }

    await writeAudit({
      actorId: session.user.id,
      action: `email.${decision}`,
      entityType: "EmailMessage",
      entityId: id,
      before: { status: email.status, subject: email.subject },
      after: { status: updatedEmail.status, subject: updatedEmail.subject, leadStatus: lead ?? null },
      ...requestMeta(req),
    });

    return json({
      ok: true,
      decision,
      emailStatus: updatedEmail.status,
      leadStatus: lead ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
