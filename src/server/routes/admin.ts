import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getSessionUser, isAdminUser } from "../auth.js";
import { ApiError } from "../errors.js";
import { adminFeedbackQuerySchema, createCommentSchema, mergeFeedbackSchema, updateFeedbackSchema } from "../schemas.js";
import { config } from "../config.js";
import { createCompletedNotification, getOrCreateMember } from "../services.js";
import { prisma } from "../prisma.js";

async function requireAdmin(request: FastifyRequest, _reply: FastifyReply) {
  const auth = request.headers.authorization;
  const headerKey = request.headers["x-admin-api-key"];
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : undefined;

  if (config.adminApiKey && (bearer === config.adminApiKey || headerKey === config.adminApiKey)) {
    return;
  }

  const user = await getSessionUser(request);
  if (isAdminUser(user)) return;

  throw new ApiError(401, "Unauthorized");
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAdmin);

  app.get("/api/v1/admin/feedbacks", async (request) => {
    const query = adminFeedbackQuerySchema.parse(request.query);

    const feedbacks = await prisma.feedback.findMany({
      where: {
        mergedIntoId: null,
        project: query.projectSlug ? { slug: query.projectSlug } : undefined,
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

    const before = await prisma.feedback.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "Feedback not found");

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
