-- AlterTable invoices: project billing, PDF, billing type
CREATE TYPE "InvoiceBillingType" AS ENUM ('MILESTONE', 'HOURLY', 'TASK', 'CUSTOM');

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "milestoneId" TEXT,
  ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Invoice',
  ADD COLUMN IF NOT EXISTS "billingType" "InvoiceBillingType" NOT NULL DEFAULT 'CUSTOM',
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pdfName" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "pdfStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfStorageUrl" TEXT;

-- Widen notes if needed
ALTER TABLE "invoices" ALTER COLUMN "notes" TYPE TEXT;
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'AED';

CREATE INDEX IF NOT EXISTS "invoices_projectId_idx" ON "invoices"("projectId");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_milestoneId_fkey"
    FOREIGN KEY ("milestoneId") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
