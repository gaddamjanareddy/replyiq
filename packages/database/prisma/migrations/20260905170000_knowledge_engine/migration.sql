-- Milestone 5: the knowledge engine.
--
-- Two tables. KnowledgeSource is where knowledge came from - one page of the
-- business's verified website, or the owner writing an answer by hand.
-- KnowledgeItem is an answerable unit: a question and its answer, or a section
-- heading and the text beneath it.
--
-- The SITE_PAGE path is the product wedge (see 18-DIFFERENTIATION.md D1):
-- because the business proved it controls the domain, we can read that site and
-- populate this before the owner has done anything.

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('SITE_PAGE', 'FAQ', 'DOCUMENT');
-- CreateEnum
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('PENDING', 'FETCHING', 'READY', 'FAILED');
-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "domainId" UUID,
    "type" "KnowledgeSourceType" NOT NULL,
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'PENDING',
    "url" VARCHAR(2048),
    "title" VARCHAR(500),
    "lastFetchedAt" TIMESTAMP(3),
    "failureReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "question" VARCHAR(500),
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "knowledge_sources_businessId_status_deletedAt_idx" ON "knowledge_sources"("businessId", "status", "deletedAt");
-- CreateIndex
CREATE INDEX "knowledge_sources_businessId_type_idx" ON "knowledge_sources"("businessId", "type");
-- CreateIndex
CREATE UNIQUE INDEX "knowledge_sources_businessId_url_key" ON "knowledge_sources"("businessId", "url");
-- CreateIndex
CREATE INDEX "knowledge_items_businessId_deletedAt_idx" ON "knowledge_items"("businessId", "deletedAt");
-- CreateIndex
CREATE INDEX "knowledge_items_sourceId_position_idx" ON "knowledge_items"("sourceId", "position");
-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search.
--
-- Prisma's DSL cannot express a GIN index over a computed tsvector, so this is
-- hand-maintained. It is what makes retrieval work without embeddings: good
-- enough to prove the loop end to end, and the column the AI layer will later
-- rank against rather than replace.
--
-- Weighted A/B so a match in the question outranks a match in the body - a
-- page that *asks* "what are your opening hours" is a better answer than one
-- that mentions hours in passing.
CREATE INDEX "knowledge_items_search_idx"
  ON "knowledge_items"
  USING GIN (
    (
      setweight(to_tsvector('english', coalesce("question", '')), 'A') ||
      setweight(to_tsvector('english', coalesce("content", '')), 'B')
    )
  );

-- Partial index for the hot path: "all live knowledge for this business".
CREATE INDEX "knowledge_items_business_active_idx"
  ON "knowledge_items"("businessId")
  WHERE "deletedAt" IS NULL;
