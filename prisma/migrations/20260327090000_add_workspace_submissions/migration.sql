-- CreateEnum
CREATE TYPE "WorkspaceSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "workspace_submissions" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "submitterUserId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "status" "WorkspaceSubmissionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "workspace_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_workspace_project_status_created"
ON "workspace_submissions"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idx_workspace_submitter_created"
ON "workspace_submissions"("submitterUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "workspace_submissions"
ADD CONSTRAINT "workspace_submissions_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_submissions"
ADD CONSTRAINT "workspace_submissions_submitterUserId_fkey"
FOREIGN KEY ("submitterUserId") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_submissions"
ADD CONSTRAINT "workspace_submissions_reviewerUserId_fkey"
FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
