-- AlterTable
ALTER TABLE "clients" ADD COLUMN "setupToken" TEXT,
ADD COLUMN "setupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requireNda" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ndaTemplateId" TEXT,
ADD COLUMN "accountSetupAt" TIMESTAMP(3),
ADD COLUMN "ndaSignedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "clients_setupToken_key" ON "clients"("setupToken");

-- CreateIndex
CREATE INDEX "clients_setupToken_idx" ON "clients"("setupToken");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_ndaTemplateId_fkey" FOREIGN KEY ("ndaTemplateId") REFERENCES "nda_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
