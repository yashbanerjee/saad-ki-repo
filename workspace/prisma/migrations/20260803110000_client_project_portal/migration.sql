-- AlterTable
ALTER TABLE "projects" ADD COLUMN "portalToken" TEXT,
ADD COLUMN "portalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "projects_portalToken_key" ON "projects"("portalToken");

-- CreateIndex
CREATE INDEX "projects_portalToken_idx" ON "projects"("portalToken");

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PLANNED',
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "client_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "estimatedHours" DECIMAL(8,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_tasks_projectId_idx" ON "client_tasks"("projectId");

-- CreateIndex
CREATE INDEX "client_tasks_milestoneId_idx" ON "client_tasks"("milestoneId");

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
