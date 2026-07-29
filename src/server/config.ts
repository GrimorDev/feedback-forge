import "dotenv/config";

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/feedback_forge",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  adminApiKey: process.env.ADMIN_API_KEY,
  defaultProjectSlug: process.env.DEFAULT_PROJECT_SLUG ?? process.env.PROJECT_SLUG ?? "orbit-chat",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "ff_session",
  cookieSecure:
    process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.COOKIE_SECURE === "true"
        ? true
        : (process.env.PUBLIC_BASE_URL ?? "").startsWith("https://") || process.env.NODE_ENV === "production",
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
  discordBotToken: process.env.DISCORD_BOT_TOKEN,
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI,
  adminDiscordIds: (process.env.ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  enablePayments: process.env.ENABLE_PAYMENTS === "true" || process.env.VITE_ENABLE_PAYMENTS === "true"
};
