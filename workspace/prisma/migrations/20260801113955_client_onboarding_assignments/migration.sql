-- AlterTable
ALTER TABLE "onboarding_forms" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "client_onboarding_assignments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "assignedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_onboarding_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_onboarding_assignments_companyId_idx" ON "client_onboarding_assignments"("companyId");

-- CreateIndex
CREATE INDEX "client_onboarding_assignments_formId_idx" ON "client_onboarding_assignments"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "client_onboarding_assignments_clientId_formId_key" ON "client_onboarding_assignments"("clientId", "formId");

-- CreateIndex
CREATE INDEX "onboarding_forms_clientId_idx" ON "onboarding_forms"("clientId");

-- AddForeignKey
ALTER TABLE "onboarding_forms" ADD CONSTRAINT "onboarding_forms_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_assignments" ADD CONSTRAINT "client_onboarding_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_assignments" ADD CONSTRAINT "client_onboarding_assignments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_assignments" ADD CONSTRAINT "client_onboarding_assignments_formId_fkey" FOREIGN KEY ("formId") REFERENCES "onboarding_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_onboarding_assignments" ADD CONSTRAINT "client_onboarding_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
