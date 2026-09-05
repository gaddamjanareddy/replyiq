-- Password reset.
--
-- Before this table existed there was no recovery path anywhere in the product:
-- a user who forgot their password was locked out of their business for good.
--
-- Only the SHA-256 of each token is stored. The raw token lives in the user's
-- inbox and nowhere else, so a database leak cannot be replayed into account
-- takeover - which is the entire risk this table carries, since a valid row is
-- by definition a way to become someone.
--
-- SHA-256 rather than bcrypt is deliberate: the token is 32 bytes of CSPRNG
-- output, so there is no dictionary to attack and a work factor would only slow
-- the legitimate lookup. Password hashing solves a problem this value does not
-- have.
--
-- `usedAt` is what makes a token single-use; rows are retained rather than
-- deleted so a spent link can be recognised as spent instead of merely unknown.

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- The lookup is by hash, so this index is the hot path as well as the
-- uniqueness guarantee.
-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- Supports expiry sweeps without scanning the table.
-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- Deleting a user must take their outstanding reset links with them: a live
-- token for a deleted account would be a way back into nothing, or worse, into
-- a recycled row.
-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
