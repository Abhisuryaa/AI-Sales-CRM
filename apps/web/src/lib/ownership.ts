import type { Session } from "next-auth";

import { db } from "@/lib/db";
import { canWriteOwner, forbidden, notFound } from "@/lib/rbac";

type OwnershipModel = "company" | "contact" | "deal" | "task";

/**
 * Loads a record and verifies the session user may mutate it.
 * Throws ApiError 404/403 when missing/denied.
 */
export async function assertCanMutate(
  session: Session,
  model: OwnershipModel,
  id: string,
): Promise<{ ownerId: string | null }> {
  let ownerId: string | null = null;
  if (model === "company") {
    const row = await db.company.findUnique({ where: { id }, select: { ownerId: true } });
    if (!row) throw notFound("Company not found");
    ownerId = row.ownerId;
  } else if (model === "contact") {
    const row = await db.contact.findUnique({ where: { id }, select: { ownerId: true } });
    if (!row) throw notFound("Contact not found");
    ownerId = row.ownerId;
  } else if (model === "deal") {
    const row = await db.deal.findUnique({ where: { id }, select: { ownerId: true } });
    if (!row) throw notFound("Deal not found");
    ownerId = row.ownerId;
  } else {
    const row = await db.task.findUnique({
      where: { id },
      select: { assigneeId: true, createdById: true },
    });
    if (!row) throw notFound("Task not found");
    ownerId = row.assigneeId ?? row.createdById;
  }

  if (!canWriteOwner({ role: session.user.role, id: session.user.id }, ownerId)) {
    throw forbidden("You do not have permission to modify this record");
  }
  return { ownerId };
}

/** Converts Prisma Decimal fields to plain numbers for JSON serialization. */
export function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}
