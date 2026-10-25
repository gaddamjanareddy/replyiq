-- Whether the owner was actually told about a captured lead.
--
-- The widget promises the visitor "leave your number and they'll come back to
-- you", and the owner is emailed. That email is fire-and-forget with its
-- errors swallowed, deliberately: a dead mail server must not turn a captured
-- lead into an error the visitor sees and does not retry.
--
-- The cost of that choice was a silent failure. On a shared sending address
-- the provider delivers only to the account owner, so for a real customer the
-- email 403s, the lead sits unread, and the visitor was told something untrue.
-- Recording the outcome makes it visible without making it block anything.

-- CreateEnum
CREATE TYPE "LeadNotifyStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'NOT_CONFIGURED');

-- AlterTable
ALTER TABLE "receptionist_leads"
  ADD COLUMN "notifyStatus" "LeadNotifyStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- Existing rows predate the column. They are left PENDING rather than
-- backfilled to SENT: we do not know whether those emails arrived, and
-- claiming they did is the exact dishonesty this column exists to prevent.
