ALTER TABLE "Vote" ADD COLUMN "projectId" TEXT;

UPDATE "Vote"
SET "projectId" = "Feedback"."projectId"
FROM "Feedback"
WHERE "Vote"."feedbackId" = "Feedback"."id";

ALTER TABLE "Vote" ALTER COLUMN "projectId" SET NOT NULL;

CREATE INDEX "Vote_projectId_createdAt_idx" ON "Vote"("projectId", "createdAt");

ALTER TABLE "Vote"
ADD CONSTRAINT "Vote_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
