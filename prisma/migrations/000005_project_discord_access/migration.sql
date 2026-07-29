ALTER TABLE "Project" ADD COLUMN "requireDiscordAuth" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "discordGuildId" TEXT;
ALTER TABLE "Project" ADD COLUMN "discordRoleId" TEXT;
