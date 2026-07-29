import type { Prisma, User } from "@prisma/client";
import { prisma } from "./prisma.js";

type Identity = {
  email?: string;
  name?: string;
  discordId?: string;
  githubId?: string;
};

export async function getOrCreateMember(identity: Identity): Promise<User> {
  if (identity.email) {
    return prisma.user.upsert({
      where: { email: identity.email },
      update: {
        name: identity.name,
        discordId: identity.discordId,
        githubId: identity.githubId
      },
      create: {
        email: identity.email,
        name: identity.name,
        discordId: identity.discordId,
        githubId: identity.githubId
      }
    });
  }

  if (identity.discordId) {
    const email = `discord-${identity.discordId}@feedback.local`;
    return prisma.user.upsert({
      where: { discordId: identity.discordId },
      update: { name: identity.name },
      create: {
        email,
        name: identity.name ?? `Discord ${identity.discordId}`,
        discordId: identity.discordId
      }
    });
  }

  if (identity.githubId) {
    const email = `github-${identity.githubId}@feedback.local`;
    return prisma.user.upsert({
      where: { githubId: identity.githubId },
      update: { name: identity.name },
      create: {
        email,
        name: identity.name ?? `GitHub ${identity.githubId}`,
        githubId: identity.githubId
      }
    });
  }

  const id = crypto.randomUUID();
  return prisma.user.create({
    data: {
      email: `anonymous-${id}@feedback.local`,
      name: identity.name ?? "Anonymous member"
    }
  });
}

export async function ensureProject(slug: string) {
  return prisma.project.findUniqueOrThrow({
    where: { slug }
  });
}

export function publicFeedbackInclude() {
  return {
    author: {
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        discordId: true,
        githubId: true
      }
    },
    comments: {
      where: { isInternal: false },
      orderBy: { createdAt: "asc" as const },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true
          }
        }
      }
    }
  } satisfies Prisma.FeedbackInclude;
}

export async function createCompletedNotification(feedbackId: string) {
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    include: {
      author: true
    }
  });

  if (!feedback) return null;

  const channel = feedback.author.discordId ? "DISCORD" : "EMAIL";
  const recipient = feedback.author.discordId
    ? `discord:${feedback.author.discordId}`
    : feedback.author.email;

  return prisma.notificationEvent.create({
    data: {
      feedbackId,
      channel,
      recipient,
      message: `Sugestia "${feedback.title}" została wdrożona.`
    }
  });
}

