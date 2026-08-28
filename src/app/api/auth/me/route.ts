import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getUserPermissions } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      companies: {
        where: { status: "ACTIVE" },
        include: { company: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permissions = await getUserPermissions(user.id, session.companyId ?? null);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: session.companyId,
      companies: user.companies.map((c) => ({
        id: c.company.id,
        legalName: c.company.legalName,
        tradeName: c.company.tradeName,
      })),
      permissions,
    },
  });
}
