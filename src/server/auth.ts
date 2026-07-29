import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { config } from "./config.js";
import { prisma } from "./prisma.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}

export async function createSession(reply: FastifyReply, userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * DAY_MS);

  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(token),
      expiresAt,
      userId
    }
  });

  reply.setCookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
    expires: expiresAt
  });
}

export async function clearSession(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[config.sessionCookieName];
  if (token) {
    await prisma.authSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  reply.clearCookie(config.sessionCookieName, { path: "/" });
}

export async function getSessionUser(request: FastifyRequest): Promise<User | null> {
  const token = request.cookies[config.sessionCookieName];
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.authSession.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session.user;
}

export function isAdminUser(user: User | null) {
  return user?.role === "ADMIN";
}
