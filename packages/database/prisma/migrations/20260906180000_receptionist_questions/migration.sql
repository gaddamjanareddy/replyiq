-- What visitors actually asked, and how well it was handled.
--
-- This is the product's feedback loop. Questions that came back `unknown` are
-- exactly the answers the owner should write next, and nothing replaces seeing
-- what people really type.
--
-- Deliberately absent: IP address, user agent, cookie, or anything else that
-- identifies the person asking. The owner needs to know WHAT was asked, never
-- BY WHOM, and storing the second would create a data-protection obligation
-- that buys the product nothing. `sessionKey` is a random per-visit value
-- generated in the browser - enough to group one conversation, useless for
-- following anyone between visits.

-- CreateTable
CREATE TABLE "receptionist_questions" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "confidence" VARCHAR(16) NOT NULL,
    "itemId" UUID,
    "sessionKey" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receptionist_questions_pkey" PRIMARY KEY ("id")
);

-- The main list: one business's questions, newest first.
-- CreateIndex
CREATE INDEX "receptionist_questions_businessId_createdAt_idx" ON "receptionist_questions"("businessId", "createdAt");

-- Serves the gap report directly, without scanning a busy business's history.
-- CreateIndex
CREATE INDEX "receptionist_questions_businessId_confidence_createdAt_idx" ON "receptionist_questions"("businessId", "confidence", "createdAt");

-- Deleting a business takes its question history with it. There is no reason
-- to keep visitor text belonging to an account that no longer exists.
-- AddForeignKey
ALTER TABLE "receptionist_questions" ADD CONSTRAINT "receptionist_questions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
