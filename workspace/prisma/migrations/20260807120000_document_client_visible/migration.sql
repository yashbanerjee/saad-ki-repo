-- Client-facing document visibility toggle
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "isClientVisible" BOOLEAN NOT NULL DEFAULT false;
