-- Organization browser icon (sidebar/logo already uses "logo")

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "favicon" TEXT;
