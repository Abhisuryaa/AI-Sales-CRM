import { auth } from "@/auth";
import type { Role } from "@/lib/types";

/**
 * Returns the current session or null when unauthenticated.
 */
export async function getSession() {
  return await auth();
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function unauthorized(message = "Unauthorized") {
  return new ApiError(401, message);
}

export function forbidden(message = "Forbidden") {
  return new ApiError(403, message);
}

export function notFound(message = "Not found") {
  return new ApiError(404, message);
}

export function badRequest(message = "Invalid request") {
  return new ApiError(400, message);
}

/**
 * Returns the session or throws an ApiError with 401/403 status.
 * When `roles` is provided, only those roles are allowed through.
 */
export async function requireAuth(roles?: Role[]) {
  const session = await auth();
  if (!session?.user?.id) throw unauthorized();
  if (roles && roles.length > 0 && !roles.includes(session.user.role)) {
    throw forbidden();
  }
  return session;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof requireAuth>>>["user"];

/**
 * Whether the user may mutate a record owned by `ownerId`.
 * ADMIN/MANAGER can write anything; SALES_REP only their own; VIEWER nothing.
 */
export function canWriteOwner(
  user: { role: Role; id: string },
  ownerId: string | null | undefined,
): boolean {
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  if (user.role === "SALES_REP") return ownerId != null && ownerId === user.id;
  return false;
}
