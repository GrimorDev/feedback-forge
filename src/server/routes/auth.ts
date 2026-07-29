import type { FastifyInstance } from "fastify";
import { ApiError } from "../errors.js";
import { createOAuthState, createSession, clearSession, getSessionUser, isAdminUser } from "../auth.js";
import { config } from "../config.js";
import { prisma } from "../prisma.js";

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  email?: string | null;
};

function discordAvatarUrl(user: DiscordUser) {
  return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/v1/auth/me", async (request) => {
    const user = await getSessionUser(request);

    return {
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            discordId: user.discordId,
            role: user.role
          }
        : null,
      isAdmin: isAdminUser(user)
    };
  });

  app.get("/api/v1/auth/discord/start", async (_request, reply) => {
    if (!config.discordClientId) {
      throw new ApiError(501, "Discord OAuth is not configured");
    }

    const state = createOAuthState();
    const redirectUri = config.discordRedirectUri ?? `${config.publicBaseUrl}/api/v1/auth/discord/callback`;
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", config.discordClientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify email");
    url.searchParams.set("state", state);

    reply.setCookie("ff_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.nodeEnv === "production",
      path: "/api/v1/auth/discord",
      maxAge: 10 * 60
    });

    return reply.redirect(url.toString());
  });

  app.get("/api/v1/auth/discord/callback", async (request, reply) => {
    if (!config.discordClientId || !config.discordClientSecret) {
      throw new ApiError(501, "Discord OAuth is not configured");
    }

    const query = request.query as { code?: string; state?: string };
    const expectedState = request.cookies.ff_oauth_state;
    if (!query.code || !query.state || query.state !== expectedState) {
      throw new ApiError(400, "Invalid OAuth state");
    }

    const redirectUri = config.discordRedirectUri ?? `${config.publicBaseUrl}/api/v1/auth/discord/callback`;
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.discordClientId,
        client_secret: config.discordClientSecret,
        grant_type: "authorization_code",
        code: query.code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      throw new ApiError(401, "Discord token exchange failed");
    }

    const token = (await tokenResponse.json()) as DiscordTokenResponse;
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `${token.token_type} ${token.access_token}` }
    });

    if (!userResponse.ok) {
      throw new ApiError(401, "Discord profile fetch failed");
    }

    const discordUser = (await userResponse.json()) as DiscordUser;
    const isConfiguredAdmin = config.adminDiscordIds.includes(discordUser.id);
    const fallbackEmail = `discord-${discordUser.id}@feedback.local`;
    const user = await prisma.user.upsert({
      where: { discordId: discordUser.id },
      update: {
        email: discordUser.email ?? fallbackEmail,
        name: discordUser.global_name ?? discordUser.username,
        avatarUrl: discordAvatarUrl(discordUser),
        role: isConfiguredAdmin ? "ADMIN" : undefined
      },
      create: {
        email: discordUser.email ?? fallbackEmail,
        name: discordUser.global_name ?? discordUser.username,
        avatarUrl: discordAvatarUrl(discordUser),
        discordId: discordUser.id,
        role: isConfiguredAdmin ? "ADMIN" : "MEMBER"
      }
    });

    await createSession(reply, user.id);
    reply.clearCookie("ff_oauth_state", { path: "/api/v1/auth/discord" });

    return reply.redirect(user.role === "ADMIN" ? "/admin" : "/board");
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    await clearSession(request, reply);
    return { ok: true };
  });
}
