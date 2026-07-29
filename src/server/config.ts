import "dotenv/config";

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/feedback_forge",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  adminApiKey: process.env.ADMIN_API_KEY,
  enablePayments: process.env.ENABLE_PAYMENTS === "true" || process.env.VITE_ENABLE_PAYMENTS === "true"
};

