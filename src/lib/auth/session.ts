import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

const SESSION_COOKIE = "lbmt_session";
const SESSION_DAYS = 7;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set and at least 16 characters");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  email: string;
  sessionId: string;
  companyId?: string;
};

export async function createSession(params: {
  userId: string;
  email: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const session = await prisma.session.create({
    data: {
      userId: params.userId,
      token: crypto.randomUUID(),
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  const token = await new SignJWT({
    userId: params.userId,
    email: params.email,
    sessionId: session.id,
    companyId: params.companyId,
  } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  await prisma.session.update({
    where: { id: session.id },
    data: { token },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const data = payload as unknown as SessionPayload;
    const dbSession = await prisma.session.findUnique({
      where: { id: data.sessionId },
    });
    if (!dbSession || dbSession.expiresAt < new Date()) {
      await destroySession();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const data = payload as unknown as SessionPayload;
      await prisma.session.deleteMany({ where: { id: data.sessionId } });
    } catch {
      // ignore
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function setActiveCompany(companyId: string) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const link = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: session.userId, companyId } },
  });
  if (!link || link.status !== "ACTIVE") {
    throw new Error("No access to this company");
  }
  await destroySession();
  await createSession({
    userId: session.userId,
    email: session.email,
    companyId,
  });
}

export { SESSION_COOKIE };
