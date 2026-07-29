import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { discordSuggestSchema, githubIssueSchema, outboundEventSchema } from "../schemas.js";
import { ensureProject, getOrCreateMember, publicFeedbackInclude } from "../services.js";
import { prisma } from "../prisma.js";

export async function registerWebhookRoutes(app: FastifyInstance) {
  app.post("/api/v1/webhooks/discord/suggest", async (request, reply) => {
    const body = discordSuggestSchema.parse(request.body);
    let project = body.projectSlug ? await ensureProject(body.projectSlug) : null;

    if (!project && body.guildId) {
      const integrations = await prisma.integration.findMany({
        where: {
          provider: "DISCORD",
          enabled: true
        },
        include: {
          project: true
        }
      });
      const integration = integrations.find((item) => {
        const integrationConfig = item.config;
        return (
          integrationConfig &&
          typeof integrationConfig === "object" &&
          !Array.isArray(integrationConfig) &&
          "guildId" in integrationConfig &&
          integrationConfig.guildId === body.guildId
        );
      });
      project = integration?.project ?? null;
    }

    if (!project) {
      return reply.status(404).send({ error: "Discord server is not connected to a project" });
    }

    const author = await getOrCreateMember({
      discordId: body.discordId,
      name: body.authorName
    });

    const feedback = await prisma.feedback.create({
      data: {
        projectId: project.id,
        authorId: author.id,
        title: body.title,
        description: body.description,
        category: "FEATURE",
        source: "DISCORD",
        tags: body.channelId ? ["discord", `discord:${body.channelId}`] : ["discord"]
      },
      include: publicFeedbackInclude()
    });

    return reply.status(201).send({ feedback });
  });

  app.post("/api/v1/webhooks/github/issues", async (request, reply) => {
    const body = githubIssueSchema.parse(request.body);
    const project = await ensureProject(body.projectSlug);
    const author = await getOrCreateMember({
      githubId: body.githubId,
      name: body.authorName
    });

    const feedback = await prisma.feedback.create({
      data: {
        projectId: project.id,
        authorId: author.id,
        title: body.title,
        description: body.description,
        category: "FEATURE",
        source: "GITHUB",
        externalUrl: body.issueUrl,
        tags: ["github"]
      },
      include: publicFeedbackInclude()
    });

    return reply.status(201).send({ feedback });
  });

  app.post("/api/v1/webhooks/stripe", async () => {
    if (!config.enablePayments) {
      return { received: true, paymentsEnabled: false, action: "ignored" };
    }

    return { received: true, paymentsEnabled: true, action: "handler-ready" };
  });

  app.post("/api/v1/webhooks/events", async (request, reply) => {
    const body = outboundEventSchema.parse(request.body);
    const event = await prisma.notificationEvent.create({
      data: body
    });

    return reply.status(202).send({ event });
  });
}
