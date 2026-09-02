import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

interface AuditContext {
  ip?: string | null;
  userAgent?: string | null;
}

type AuditInput = {
  actorId: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
} & AuditContext;

/**
 * Persists an AuditLog row. Failures are logged but never thrown so that
 * audit writes never break the primary mutation.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", error);
  }
}

/** Extracts client ip + user-agent from a Next.js Request for audit trails. */
export function requestMeta(req: Request): AuditContext {
  return {
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    userAgent: req.headers.get("user-agent"),
  };
}
