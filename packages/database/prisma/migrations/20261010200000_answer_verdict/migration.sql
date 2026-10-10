-- The owner's verdict on an answer the receptionist gave.
--
-- Closes the quality loop. The product's whole claim is that it does not
-- invent, and until now there was no way for the one person who can tell —
-- the owner — to say "that was wrong". STRATEGY.md §5 targets "answers the
-- owner marks wrong < 3%" and had no input to measure.
--
-- Nullable on purpose and never defaulted: null means nobody has reviewed it,
-- which is NOT the same as "fine". The accuracy figure is a share of reviewed
-- answers, and defaulting unreviewed rows to GOOD would make the number say
-- whatever we wanted it to.

-- CreateEnum
CREATE TYPE "AnswerVerdict" AS ENUM ('GOOD', 'WRONG');

-- AlterTable
ALTER TABLE "receptionist_questions" ADD COLUMN "verdict" "AnswerVerdict";

-- Serves "show me the ones I marked wrong" without scanning the history of a
-- busy business.
-- CreateIndex
CREATE INDEX "receptionist_questions_businessId_verdict_idx" ON "receptionist_questions"("businessId", "verdict");
