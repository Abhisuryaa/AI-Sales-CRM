import { hashSync } from "bcryptjs";

import { db } from "@/lib/db";
import { requestMeta, writeAudit } from "@/lib/audit";
import { handleApiError, json, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/rbac";
import { registerSchema } from "@/lib/schemas";

export async function GET() {
  try {
    await requireAuth(["ADMIN"]);

    const users = await db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return json({ data: users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(["ADMIN"]);
    const body = await parseBody(req, registerSchema);

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) return json({ error: "A user with this email already exists" }, 409);

    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash: hashSync(body.password, 10),
        name: body.name,
        role: body.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAudit({
      actorId: session.user.id,
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, name: user.name, role: user.role },
      ...requestMeta(req),
    });

    return json(user, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
