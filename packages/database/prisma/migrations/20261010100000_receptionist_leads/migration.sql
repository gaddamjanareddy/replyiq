-- Visitors who asked something the receptionist refused to guess at, and left
-- a way to be contacted.
--
-- This is the commercial half of the honesty rule. "I don't know" was already
-- the right answer; on its own it also ended the conversation, so the owner
-- never learned the visitor existed. Now it hands over.
--
-- ── This table is NOT like receptionist_questions ─────────────────────────
-- That table is deliberately anonymous and must stay that way. This one holds
-- a contact detail the visitor was asked for, told the purpose of, and typed
-- anyway. The records are deliberately NOT joined: linking a lead to its
-- session would retroactively de-anonymise every other question asked during
-- that visit. The triggering question is copied here instead.

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadContactKind" AS ENUM ('EMAIL', 'PHONE');

-- CreateTable
CREATE TABLE "receptionist_leads" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" VARCHAR(120),
    "contact" VARCHAR(200) NOT NULL,
    "contactKind" "LeadContactKind" NOT NULL,
    "question" VARCHAR(500),
    "message" VARCHAR(1000),
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receptionist_leads_pkey" PRIMARY KEY ("id")
);

-- The owner's list: newest first.
-- CreateIndex
CREATE INDEX "receptionist_leads_businessId_createdAt_idx" ON "receptionist_leads"("businessId", "createdAt");

-- "What still needs a call", without scanning the ones already handled.
-- CreateIndex
CREATE INDEX "receptionist_leads_businessId_status_createdAt_idx" ON "receptionist_leads"("businessId", "status", "createdAt");

-- Deleting a business takes its leads with it. Keeping a stranger's phone
-- number on behalf of an account that no longer exists would be indefensible.
-- AddForeignKey
ALTER TABLE "receptionist_leads" ADD CONSTRAINT "receptionist_leads_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
