import { z } from "zod";

export const categorySchema = z.enum(["BUG", "FEATURE", "IMPROVEMENT"]);
export const statusSchema = z.enum([
  "TRIAGE",
  "UNDER_REVIEW",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED"
]);
export const sourceSchema = z.enum(["WEB_WIDGET", "DISCORD", "GITHUB", "API"]);

export const userIdentitySchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(120).optional(),
  discordId: z.string().min(1).max(120).optional(),
  githubId: z.string().min(1).max(120).optional()
});

export const createFeedbackSchema = userIdentitySchema.extend({
  title: z.string().min(5).max(180),
  description: z.string().min(10).max(5000),
  category: categorySchema.default("FEATURE"),
  source: sourceSchema.default("WEB_WIDGET"),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  externalUrl: z.string().url().optional()
});

export const voteSchema = userIdentitySchema;

export const adminFeedbackQuerySchema = z.object({
  projectSlug: z.string().min(1).optional(),
  status: statusSchema.optional(),
  category: categorySchema.optional(),
  source: sourceSchema.optional(),
  q: z.string().max(200).optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(50)
});

export const updateFeedbackSchema = z.object({
  status: statusSchema.optional(),
  category: categorySchema.optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  title: z.string().min(5).max(180).optional(),
  description: z.string().min(10).max(5000).optional()
});

export const mergeFeedbackSchema = z.object({
  duplicateId: z.string().uuid()
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
  authorEmail: z.string().email().optional(),
  authorName: z.string().min(1).max(120).optional()
});

export const updateProjectSettingsSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  customDomain: z.string().max(255).nullable().optional(),
  publicRoadmap: z.boolean().optional(),
  requireLoginToVote: z.boolean().optional(),
  moderatorDiscordIds: z.array(z.string().min(1).max(120)).max(25).optional()
});

export const updateIntegrationSchema = z.object({
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({})
});

export const discordSuggestSchema = z.object({
  projectSlug: z.string().min(1),
  title: z.string().min(5).max(180),
  description: z.string().min(10).max(5000),
  discordId: z.string().min(1).max(120),
  authorName: z.string().min(1).max(120).optional(),
  channelId: z.string().min(1).max(120).optional()
});

export const githubIssueSchema = z.object({
  projectSlug: z.string().min(1),
  title: z.string().min(5).max(180),
  description: z.string().min(10).max(5000),
  githubId: z.string().min(1).max(120),
  authorName: z.string().min(1).max(120).optional(),
  issueUrl: z.string().url().optional()
});

export const outboundEventSchema = z.object({
  feedbackId: z.string().uuid(),
  channel: z.enum(["EMAIL", "DISCORD"]),
  recipient: z.string().min(1).max(500),
  message: z.string().min(1).max(1000)
});
