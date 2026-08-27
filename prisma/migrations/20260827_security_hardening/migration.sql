ALTER TABLE "TwitchConfig" DROP COLUMN IF EXISTS "clientSecret";
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "Squad" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
CREATE UNIQUE INDEX IF NOT EXISTS "Game_guildId_name_key" ON "Game"("guildId", "name");
DROP INDEX IF EXISTS "Game_name_key";
CREATE INDEX IF NOT EXISTS "Squad_guildId_idx" ON "Squad"("guildId");

CREATE TABLE IF NOT EXISTS "ReputationParticipant" (
  "id" TEXT NOT NULL,
  "squadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReputationParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReputationParticipant_squadId_userId_key" ON "ReputationParticipant"("squadId", "userId");
CREATE INDEX IF NOT EXISTS "ReputationParticipant_squadId_expiresAt_idx" ON "ReputationParticipant"("squadId", "expiresAt");

CREATE TABLE IF NOT EXISTS "ReputationVote" (
  "id" TEXT NOT NULL,
  "squadId" TEXT NOT NULL,
  "voterId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReputationVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReputationVote_squadId_voterId_targetId_type_key" ON "ReputationVote"("squadId", "voterId", "targetId", "type");
CREATE INDEX IF NOT EXISTS "ReputationVote_squadId_voterId_idx" ON "ReputationVote"("squadId", "voterId");

CREATE TABLE IF NOT EXISTS "PurchaseLedger" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseLedger_userId_requestId_key" ON "PurchaseLedger"("userId", "requestId");
CREATE INDEX IF NOT EXISTS "PurchaseLedger_userId_createdAt_idx" ON "PurchaseLedger"("userId", "createdAt");
