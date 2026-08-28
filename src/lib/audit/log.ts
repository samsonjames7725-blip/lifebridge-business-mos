import { prisma } from "@/lib/db/prisma";

export async function writeAuditLog(params: {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValues: params.oldValues ? (params.oldValues as object) : undefined,
        newValues: params.newValues ? (params.newValues as object) : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}
