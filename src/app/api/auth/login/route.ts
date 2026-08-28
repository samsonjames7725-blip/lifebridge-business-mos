import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit/log";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { email, password } = bodySchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        companies: {
          where: { status: "ACTIVE" },
          include: { company: true },
          orderBy: { isDefault: "desc" },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const defaultCompany = user.companies[0]?.companyId;

    await createSession({
      userId: user.id,
      email: user.email,
      companyId: defaultCompany,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await writeAuditLog({
      companyId: defaultCompany,
      userId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: defaultCompany,
        companies: user.companies.map((c) => ({
          id: c.company.id,
          legalName: c.company.legalName,
          tradeName: c.company.tradeName,
        })),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("[login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
