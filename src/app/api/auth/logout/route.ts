import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST() {
  const session = await getSession();
  if (session) {
    await writeAuditLog({
      companyId: session.companyId,
      userId: session.userId,
      action: "LOGOUT",
      entityType: "User",
      entityId: session.userId,
    });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
