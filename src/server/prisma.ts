import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg(config.databaseUrl);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: config.nodeEnv === "development" ? ["error", "warn"] : ["error"]
  });

if (config.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}

