import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Project } from "@prisma/client";
import { getSessionUser } from "../auth.js";
import { config } from "../config.js";
import { ApiError } from "../errors.js";
import { createFeedbackSchema, projectDiscordFeedbackSchema, voteSchema } from "../schemas.js";
import { rateLimit } from "../rate-limit.js";
import { ensureProject, getOrCreateMember, publicFeedbackInclude } from "../services.js";
import { prisma } from "../prisma.js";

type DiscordGuildMember = {
  roles?: string[];
};

async function ensurePublicProjectAccess(request: FastifyRequest, project: Project) {
  if (!project.requireDiscordAuth) return;

  const user = await getSessionUser(request);
  if (!user?.discordId) throw new ApiError(401, "Discord login is required to access this roadmap");
  if (!project.discordGuildId) return;
  if (!config.discordBotToken) throw new ApiError(503, "Discord guild verification is not configured");

  const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${project.discordGuildId}/members/${user.discordId}`, {
    headers: { authorization: `Bot ${config.discordBotToken}` }
  });

  if (!memberResponse.ok) {
    throw new ApiError(403, "Access is limited to the configured Discord community");
  }

  if (project.discordRoleId) {
    const member = (await memberResponse.json()) as DiscordGuildMember;
    if (!member.roles?.includes(project.discordRoleId)) {
      throw new ApiError(403, "Access is limited to members with the configured Discord role");
    }
  }
}

export async function registerPublicRoutes(app: FastifyInstance) {
  app.get("/widget.js", async (_request, reply) => {
    const script = `(() => {
  const currentScript = document.currentScript;
  const projectSlug = currentScript?.dataset.project;
  if (!projectSlug || document.querySelector("[data-feedback-forge-widget]")) return;

  const apiBase = new URL(currentScript.src).origin;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Zgłoś pomysł";
  button.setAttribute("data-feedback-forge-widget", "button");
  button.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483647;border:0;border-radius:999px;background:#14b8a6;color:white;font:700 14px system-ui;padding:12px 16px;box-shadow:0 12px 34px rgba(0,0,0,.22);cursor:pointer";

  const panel = document.createElement("form");
  panel.setAttribute("data-feedback-forge-widget", "panel");
  panel.style.cssText = "position:fixed;right:18px;bottom:76px;z-index:2147483647;width:min(360px,calc(100vw - 36px));display:none;gap:10px;background:#0b1220;color:#e5edf6;border:1px solid #243244;border-radius:10px;padding:14px;box-shadow:0 18px 54px rgba(0,0,0,.36);font:14px system-ui";
  panel.innerHTML = '<strong style="font-size:15px">Nowe zgłoszenie</strong><input name="title" required minlength="5" maxlength="180" placeholder="Tytuł" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #334155;background:#111827;color:#e5edf6;padding:10px"><textarea name="description" required minlength="10" maxlength="5000" placeholder="Opis" style="width:100%;min-height:96px;box-sizing:border-box;border-radius:8px;border:1px solid #334155;background:#111827;color:#e5edf6;padding:10px"></textarea><button style="border:0;border-radius:8px;background:#14b8a6;color:white;font-weight:800;min-height:40px">Wyślij</button><small data-status style="color:#9aa8bb"></small>';

  button.addEventListener("click", () => {
    panel.style.display = panel.style.display === "grid" ? "none" : "grid";
  });

  panel.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = panel.querySelector("[data-status]");
    status.textContent = "Wysyłam...";
    const data = new FormData(panel);
    const response = await fetch(apiBase + "/api/v1/projects/" + encodeURIComponent(projectSlug) + "/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        description: data.get("description"),
        category: "FEATURE",
        source: "WEB_WIDGET",
        tags: ["widget"]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      status.textContent = error.error || "Nie udało się wysłać";
      return;
    }

    panel.reset();
    status.textContent = "Zgłoszenie trafiło do triage.";
  });

  document.body.append(panel, button);
})();`;

    return reply.type("application/javascript; charset=utf-8").send(script);
  });

  app.get("/api/v1/projects/:slug/board", async (request) => {
    const params = request.params as { slug: string };
    const project = await ensureProject(params.slug);
    await ensurePublicProjectAccess(request, project);

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
    rateLimit(request, "feedback:create", 3, 60 * 60 * 1000);
    const params = request.params as { slug: string };
    const body = createFeedbackSchema.parse(request.body);
    const project = await ensureProject(params.slug);
    await ensurePublicProjectAccess(request, project);
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
            projectId: project.id,
            userId: author.id
          }
        }
      },
      include: publicFeedbackInclude()
    });

    return reply.status(201).send({ feedback });
  });

  app.post("/api/v1/projects/:slug/feedbacks/discord", async (request, reply) => {
    rateLimit(request, "feedback:discord", 10, 60 * 1000);
    const params = request.params as { slug: string };
    const body = projectDiscordFeedbackSchema.parse(request.body);
    const project = await ensureProject(params.slug);
    const author = await getOrCreateMember({
      discordId: body.discord_user_id,
      name: body.discord_username
    });

    const feedback = await prisma.feedback.create({
      data: {
        title: body.title,
        description: body.description,
        category: "FEATURE",
        status: "TRIAGE",
        source: "DISCORD",
        tags: body.channel_id ? ["discord", `discord:${body.channel_id}`] : ["discord"],
        projectId: project.id,
        authorId: author.id
      },
      include: publicFeedbackInclude()
    });

    return reply.status(201).send({ feedback });
  });

  app.post("/api/v1/feedback/:id/vote", async (request) => {
    rateLimit(request, "feedback:vote", 10, 60 * 1000);
    const params = request.params as { id: string };
    const body = voteSchema.parse(request.body ?? {});
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id: params.id },
      include: { project: true }
    });
    if (!existingFeedback || existingFeedback.mergedIntoId) throw new ApiError(404, "Feedback not found");
    await ensurePublicProjectAccess(request, existingFeedback.project);
    if (existingFeedback.project.requireLoginToVote && !(await getSessionUser(request))) {
      throw new ApiError(401, "Login is required to vote on this project");
    }
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
          projectId: existingFeedback.projectId,
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
    await ensurePublicProjectAccess(request, project);

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
