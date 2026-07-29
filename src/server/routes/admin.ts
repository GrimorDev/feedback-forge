import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma, type Project, type User } from "@prisma/client";
import { getSessionUser } from "../auth.js";
import { ApiError } from "../errors.js";
import {
  adminFeedbackQuerySchema,
  createCommentSchema,
  createProjectSchema,
  mergeFeedbackSchema,
  sourceSchema,
  updateFeedbackSchema,
  updateIntegrationSchema,
  updateProjectSettingsSchema
} from "../schemas.js";
import { config } from "../config.js";
import { createCompletedNotification, getOrCreateMember } from "../services.js";
import { prisma } from "../prisma.js";

type AdminContext =
  | { bypass: true; user: null }
  | { bypass: false; user: User };

async function getAdminContext(request: FastifyRequest): Promise<AdminContext> {
  const auth = request.headers.authorization;
  const headerKey = request.headers["x-admin-api-key"];
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;

  if (config.adminApiKey && (bearer === config.adminApiKey || headerKey === config.adminApiKey)) {
    return { bypass: true, user: null };
  }

  const user = await getSessionUser(request);
  if (user) return { bypass: false, user };

  throw new ApiError(401, "Unauthorized");
}

async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  await getAdminContext(request);
}

function canAccessProject(context: AdminContext, project: Project) {
  if (context.bypass) return true;
  if (context.user.discordId && config.adminDiscordIds.includes(context.user.discordId)) return true;
  return project.ownerId === context.user.id || Boolean(context.user.discordId && project.moderatorDiscordIds.includes(context.user.discordId));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "project";
}

async function uniqueProjectSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;

  while (await prisma.project.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function requireProjectAccess(request: FastifyRequest, slug: string) {
  const context = await getAdminContext(request);
  const project = await prisma.project.findUnique({ where: { slug } });

  if (!project) throw new ApiError(404, "Project not found");
  if (!canAccessProject(context, project)) throw new ApiError(403, "No access to this project");

  return project;
}

async function requireFeedbackAccess(request: FastifyRequest, feedbackId: string) {
  const context = await getAdminContext(request);
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: { project: true }
  });

  if (!feedback) throw new ApiError(404, "Feedback not found");
  if (!canAccessProject(context, feedback.project)) throw new ApiError(403, "No access to this project");

  return feedback;
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/v1/admin/projects", async (request) => {
    const context = await getAdminContext(request);
    const projects = await prisma.project.findMany({
      where: context.bypass || (context.user.discordId && config.adminDiscordIds.includes(context.user.discordId))
        ? undefined
        : {
            OR: [
              { ownerId: context.user.id },
              ...(context.user.discordId ? [{ moderatorDiscordIds: { has: context.user.discordId } }] : [])
            ]
          },
      orderBy: { updatedAt: "desc" }
    });

    return { projects };
  });

  app.post("/api/v1/admin/projects", async (request, reply) => {
    const context = await getAdminContext(request);
    if (context.bypass) throw new ApiError(401, "Create a project from a Discord admin session");

    const body = createProjectSchema.parse(request.body);
    const slug = await uniqueProjectSlug(body.name);
    const project = await prisma.project.create({
      data: {
        name: body.name,
        slug,
        description: body.description ?? "Publiczna roadmapa społeczności.",
        ownerId: context.user.id
      }
    });

    return reply.status(201).send({ project });
  });

  app.get("/api/v1/admin/projects/:slug/settings", async (request) => {
    const params = request.params as { slug: string };
    await requireProjectAccess(request, params.slug);
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      include: {
        integrations: {
          orderBy: { provider: "asc" }
        }
      }
    });

    if (!project) throw new ApiError(404, "Project not found");

    return {
      project,
      integrations: project.integrations,
      instructions: {
        apiBaseUrl: config.publicBaseUrl,
        discordProjectEndpoint: `${config.publicBaseUrl}/api/v1/projects/${project.slug}/feedbacks/discord`,
        discordWebhookUrl: `${config.publicBaseUrl}/api/v1/webhooks/discord/suggest`,
        githubWebhookUrl: `${config.publicBaseUrl}/api/v1/webhooks/github/issues`,
        widgetSnippet: `<script async src="${config.publicBaseUrl}/widget.js" data-project="${project.slug}"></script>`
      }
    };
  });

  app.patch("/api/v1/admin/projects/:slug/settings", async (request) => {
    const params = request.params as { slug: string };
    await requireProjectAccess(request, params.slug);
    const body = updateProjectSettingsSchema.parse(request.body);
    const customDomain = body.customDomain === undefined ? undefined : body.customDomain?.trim() || null;

    const project = await prisma.project.update({
      where: { slug: params.slug },
      data: {
        ...body,
        description: body.description === undefined ? undefined : body.description,
        customDomain,
        discordGuildId: body.discordGuildId === undefined ? undefined : body.discordGuildId?.trim() || null,
        discordRoleId: body.discordRoleId === undefined ? undefined : body.discordRoleId?.trim() || null,
        moderatorDiscordIds: body.moderatorDiscordIds?.map((id) => id.trim()).filter(Boolean)
      }
    });

    return { project };
  });

  app.put("/api/v1/admin/projects/:slug/integrations/:provider", async (request) => {
    const params = request.params as { slug: string; provider: string };
    const provider = sourceSchema.parse(params.provider);
    const body = updateIntegrationSchema.parse(request.body);
    const project = await requireProjectAccess(request, params.slug);

    const integrationConfig = body.config as Prisma.InputJsonValue;

    const integration = await prisma.integration.upsert({
      where: {
        projectId_provider: {
          projectId: project.id,
          provider
        }
      },
      create: {
        projectId: project.id,
        provider,
        enabled: body.enabled,
        config: integrationConfig
      },
      update: {
        enabled: body.enabled,
        config: integrationConfig
      }
    });

    return { integration };
  });

  app.get("/api/v1/admin/feedbacks", async (request) => {
    const query = adminFeedbackQuerySchema.parse(request.query);
    if (!query.projectSlug) throw new ApiError(400, "projectSlug is required");
    const project = await requireProjectAccess(request, query.projectSlug);

    const feedbacks = await prisma.feedback.findMany({
      where: {
        mergedIntoId: null,
        projectId: project.id,
        status: query.status,
        category: query.category,
        source: query.source,
        OR: query.q
          ? [
              { title: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
              { tags: { has: query.q } }
            ]
          : undefined
      },
      skip: query.skip,
      take: query.take,
      orderBy: [{ priority: "desc" }, { upvotesCount: "desc" }, { createdAt: "desc" }],
      include: {
        project: true,
        author: {
          select: {
            id: true,
            email: true,
            name: true,
            discordId: true,
            githubId: true
          }
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, email: true, name: true }
            }
          }
        }
      }
    });

    return { feedbacks, pagination: { skip: query.skip, take: query.take } };
  });

  app.patch("/api/v1/admin/feedbacks/:id", async (request) => {
    const params = request.params as { id: string };
    const body = updateFeedbackSchema.parse(request.body);

    const before = await requireFeedbackAccess(request, params.id);

    const feedback = await prisma.feedback.update({
      where: { id: params.id },
      data: body
    });

    const notification =
      before.status !== "COMPLETED" && body.status === "COMPLETED"
        ? await createCompletedNotification(params.id)
        : null;

    return { feedback, notification };
  });

  app.post("/api/v1/admin/feedbacks/:id/merge", async (request) => {
    const params = request.params as { id: string };
    const body = mergeFeedbackSchema.parse(request.body);
    await requireFeedbackAccess(request, params.id);
    await requireFeedbackAccess(request, body.duplicateId);

    if (params.id === body.duplicateId) {
      throw new ApiError(400, "Cannot merge feedback into itself");
    }

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.feedback.findUnique({ where: { id: params.id } });
      const duplicate = await tx.feedback.findUnique({ where: { id: body.duplicateId } });

      if (!target || !duplicate) throw new ApiError(404, "Feedback not found");
      if (target.projectId !== duplicate.projectId) {
        throw new ApiError(400, "Feedback items must belong to the same project");
      }

      const duplicateVotes = await tx.vote.findMany({ where: { feedbackId: duplicate.id } });
      await tx.vote.createMany({
        data: duplicateVotes.map((vote) => ({
          projectId: target.projectId,
          userId: vote.userId,
          feedbackId: target.id
        })),
        skipDuplicates: true
      });
      await tx.vote.deleteMany({ where: { feedbackId: duplicate.id } });

      const upvotesCount = await tx.vote.count({ where: { feedbackId: target.id } });

      const updatedTarget = await tx.feedback.update({
        where: { id: target.id },
        data: { upvotesCount }
      });

      const mergedDuplicate = await tx.feedback.update({
        where: { id: duplicate.id },
        data: {
          mergedIntoId: target.id,
          status: "REJECTED"
        }
      });

      return { target: updatedTarget, duplicate: mergedDuplicate };
    });

    return result;
  });

  app.post("/api/v1/admin/feedbacks/:id/comments", async (request, reply) => {
    const params = request.params as { id: string };
    await requireFeedbackAccess(request, params.id);
    const body = createCommentSchema.parse(request.body);
    const author = await getOrCreateMember({
      email: body.authorEmail ?? "admin@feedback.local",
      name: body.authorName ?? "Admin"
    });

    const comment = await prisma.comment.create({
      data: {
        feedbackId: params.id,
        authorId: author.id,
        content: body.content,
        isInternal: body.isInternal
      }
    });

    return reply.status(201).send({ comment });
  });
}
