import { prisma } from "@/lib/db/prisma";

export const SYSTEM_ROLES = [
  "Super Admin", "Company Admin", "GST Manager", "Finance Manager",
  "Billing Executive", "Sales Manager", "Procurement Manager", "Inventory Manager",
  "Tender Manager", "Project Manager", "Service Engineer", "Viewer",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const PERMISSIONS = [
  "company.view", "company.create", "company.edit", "company.switch",
  "gst.view", "gst.create", "gst.edit", "gst.approve", "gst.rules.view", "gst.rules.manage",
  "gst.reconcile", "gst.itc.approve", "gst.return.prepare", "gst.return.review",
  "invoice.view", "invoice.create", "invoice.edit", "invoice.cancel", "invoice.approve",
  "quotation.view", "quotation.create", "quotation.edit", "salesorder.view", "salesorder.create",
  "payment.view", "payment.create", "purchase.view", "purchase.create", "purchase.approve",
  "inventory.view", "inventory.adjust", "tender.view", "tender.create", "tender.edit", "tender.submit",
  "project.view", "project.create", "service.view", "service.create",
  "user.manage", "user.view", "report.view", "audit.view", "document.view", "document.upload",
  "settings.manage", "integration.manage",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export async function hasPermission(
  userId: string, permissionCode: string, companyId?: string | null
): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  for (const ur of userRoles) {
    if (ur.role.name === "Super Admin" && ur.companyId === null) return true;
    if (companyId && ur.companyId && ur.companyId !== companyId) continue;
    if (ur.companyId && !companyId) continue;
    if (ur.role.rolePermissions.map((rp) => rp.permission.code).includes(permissionCode)) return true;
  }
  return false;
}

export async function requirePermission(
  userId: string, permissionCode: string, companyId?: string | null
): Promise<void> {
  if (!(await hasPermission(userId, permissionCode, companyId))) {
    throw new Error(`Forbidden: missing permission ${permissionCode}`);
  }
}

export async function getUserPermissions(
  userId: string, companyId?: string | null
): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });
  const set = new Set<string>();
  for (const ur of userRoles) {
    if (ur.role.name === "Super Admin" && ur.companyId === null) {
      PERMISSIONS.forEach((p) => set.add(p));
      break;
    }
    if (companyId && ur.companyId && ur.companyId !== companyId) continue;
    ur.role.rolePermissions.forEach((rp) => set.add(rp.permission.code));
  }
  return Array.from(set);
}
