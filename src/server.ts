import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./server/config.js";
import { sendError } from "./server/errors.js";
import { prisma } from "./server/prisma.js";
import { registerAdminRoutes } from "./server/routes/admin.js";
import { registerAuthRoutes } from "./server/routes/auth.js";
import { registerPublicRoutes } from "./server/routes/public.js";
import { registerWebhookRoutes } from "./server/routes/webhooks.js";

const app = Fastify({
  logger: {
    level: config.nodeEnv === "production" ? "info" : "debug"
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(__dirname, "../../dist");

app.register(cors, {
  origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",").map((origin) => origin.trim()),
  credentials: true
});

app.register(cookie);

app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return {
    ok: true,
    service: "feedback-forge-api",
    paymentsEnabled: config.enablePayments
  };
});

app.register(registerAuthRoutes);
app.register(registerPublicRoutes);
app.register(registerAdminRoutes);
app.register(registerWebhookRoutes);

app.register(fastifyStatic, {
  root: publicRoot,
  prefix: "/"
});

app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/") || request.url === "/health") {
    return reply.status(404).send({ error: "Not found" });
  }

  return reply.sendFile("index.html");
});

app.setErrorHandler((error, _request, reply) => {
  try {
    return sendError(reply, error);
  } catch (unhandled) {
    app.log.error(unhandled);
    return reply.status(500).send({ error: "Internal server error" });
  }
});

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

const start = async () => {
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
