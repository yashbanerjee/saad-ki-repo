-- Normalize empty phones to NULL before unique index
UPDATE "users" SET "phone" = NULL WHERE "phone" IS NOT NULL AND TRIM("phone") = '';

-- AlterTable: unique phone for login
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");

-- AlterTable: link CRM client to login user
ALTER TABLE "clients" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clients_userId_key" ON "clients"("userId");

-- CreateIndex
CREATE INDEX "clients_phone_idx" ON "clients"("phone");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
