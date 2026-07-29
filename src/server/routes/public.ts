import type { FastifyInstance } from "fastify";
import { ApiError } from "../errors.js";
import { createFeedbackSchema, voteSchema } from "../schemas.js";
import { ensureProject, getOrCreateMember, publicFeedbackInclude } from "../services.js";
import { prisma } from "../prisma.js";

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/api/v1/projects/:slug/board", async (request) => {
    const params = request.params as { slug: string };
    const project = await ensureProject(params.slug);

    const feedbacks = await prisma.feedback.findMany({
      where: {
        projectId: project.id,
        mergedIntoId: null,
        status: { in: ["PLANNED", "IN_PROGRESS", "COMPLETED"] }
      },
      orderBy: [{ status: "asc" }, { upvotesCount: "desc" }, { updatedAt: "desc" }],
      include: publicFeedbackInclude()
    });

    return { project, feedbacks };
  });

  app.post("/api/v1/projects/:slug/feedback", async (request, reply) => {
    const params = request.params as { slug: string };
    const body = createFeedbackSchema.parse(request.body);
    const project = await ensureProject(params.slug);
    const author = await getOrCreateMember(body);

    const feedback = await prisma.feedback.create({
      data: {
        title: body.title,
        description: body.description,
        category: body.category,
        source: body.source,
        tags: body.tags,
        externalUrl: body.externalUrl,
        projectId: project.id,
        authorId: author.id,
        upvotesCount: 1,
        votes: {
          create: {
            userId: author.id
          }
        }
      },
      include: publicFeedbackInclude()
    });

    return reply.status(201).send({ feedback });
  });

  app.post("/api/v1/feedback/:id/vote", async (request) => {
    const params = request.params as { id: string };
    const body = voteSchema.parse(request.body ?? {});
    const voter = await getOrCreateMember(body);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.vote.findUnique({
        where: {
          userId_feedbackId: {
            userId: voter.id,
            feedbackId: params.id
          }
        }
      });

      if (existing) {
        await tx.vote.delete({ where: { id: existing.id } });
        const upvotesCount = await tx.vote.count({ where: { feedbackId: params.id } });
        const feedback = await tx.feedback.update({
          where: { id: params.id },
          data: { upvotesCount }
        });
        return { feedback, voted: false };
      }

      await tx.vote.create({
        data: {
          userId: voter.id,
          feedbackId: params.id
        }
      });

      const upvotesCount = await tx.vote.count({ where: { feedbackId: params.id } });
      const feedback = await tx.feedback.update({
        where: { id: params.id },
        data: { upvotesCount }
      });
      return { feedback, voted: true };
    });

    return result;
  });

  app.get("/api/v1/projects/:slug/changelog", async (request) => {
    const params = request.params as { slug: string };
    const project = await ensureProject(params.slug);

    const feedbacks = await prisma.feedback.findMany({
      where: {
        projectId: project.id,
        status: "COMPLETED",
        mergedIntoId: null
      },
      orderBy: { updatedAt: "desc" },
      include: publicFeedbackInclude()
    });

    return { project, feedbacks };
  });

  app.get("/api/v1/feedback/:id", async (request) => {
    const params = request.params as { id: string };
    const feedback = await prisma.feedback.findUnique({
      where: { id: params.id },
      include: publicFeedbackInclude()
    });

    if (!feedback || feedback.mergedIntoId) {
      throw new ApiError(404, "Feedback not found");
    }

    return { feedback };
  });
}
