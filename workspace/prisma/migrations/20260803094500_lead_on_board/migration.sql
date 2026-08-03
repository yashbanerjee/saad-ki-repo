-- AlterTable
ALTER TABLE "leads" ADD COLUMN "onBoard" BOOLEAN NOT NULL DEFAULT false;

-- Keep existing pipeline cards on the board
UPDATE "leads" SET "onBoard" = true WHERE "archived" = false;

-- CreateIndex
CREATE INDEX "leads_companyId_onBoard_idx" ON "leads"("companyId", "onBoard");
