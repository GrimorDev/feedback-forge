-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('BUG', 'FEATURE', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('TRIAGE', 'UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('WEB_WIDGET', 'DISCORD', 'GITHUB', 'API');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'EARLY_ADOPTER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'DISCORD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "discordId" TEXT,
    "githubId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "plan" "Plan" NOT NULL DEFAULT 'EARLY_ADOPTER',
    "lifetimeFree" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "customDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'TRIAGE',
    "category" "Category" NOT NULL DEFAULT 'FEATURE',
    "source" "Source" NOT NULL DEFAULT 'WEB_WIDGET',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority" INTEGER NOT NULL DEFAULT 1,
    "upvotesCount" INTEGER NOT NULL DEFAULT 0,
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "mergedIntoId" TEXT,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedbackId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "provider" "Source" NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundWebhook" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "OutboundWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedbackId" TEXT NOT NULL,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerCustomerId" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_customDomain_key" ON "Project"("customDomain");

-- CreateIndex
CREATE INDEX "Feedback_projectId_status_idx" ON "Feedback"("projectId", "status");

-- CreateIndex
CREATE INDEX "Feedback_projectId_upvotesCount_idx" ON "Feedback"("projectId", "upvotesCount" DESC);

-- CreateIndex
CREATE INDEX "Feedback_projectId_category_priority_idx" ON "Feedback"("projectId", "category", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_feedbackId_key" ON "Vote"("userId", "feedbackId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_projectId_provider_key" ON "Integration"("projectId", "provider");

-- CreateIndex
CREATE INDEX "NotificationEvent_feedbackId_createdAt_idx" ON "NotificationEvent"("feedbackId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundWebhook" ADD CONSTRAINT "OutboundWebhook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
