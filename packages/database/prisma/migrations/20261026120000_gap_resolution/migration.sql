-- Marking an unanswered question as dealt with.
--
-- Separate from `itemId`, which records what answered at the time and must
-- stay true about the past. These record that the owner came back later and
-- wrote something. Both nullable, so every existing row is correctly "nobody
-- has dealt with this yet".
ALTER TABLE "receptionist_questions"
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedItemId" UUID;

-- The to-do list asks for unanswered AND unresolved, which on a business that
-- has been using the product is the smaller half of the unanswered rows.
DROP INDEX IF EXISTS "receptionist_questions_businessId_confidence_createdAt_idx";
CREATE INDEX "receptionist_questions_businessId_confidence_resolvedAt_crea_idx"
  ON "receptionist_questions" ("businessId", "confidence", "resolvedAt", "createdAt");
