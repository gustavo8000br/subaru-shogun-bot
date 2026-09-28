-- Tenant isolation migration. Legacy rows remain addressable under the explicit legacy tenant.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "Squad" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "Squad" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Squad" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "GuildConfig" (
  "guildId" TEXT NOT NULL,
  "maxSquadsPerGame" INTEGER NOT NULL DEFAULT 10,
  "maxMembersPerSquad" INTEGER NOT NULL DEFAULT 15,
  "emptySquadTimeoutMs" BIGINT NOT NULL DEFAULT 300000,
  "inactivityTimeoutMs" BIGINT NOT NULL DEFAULT 86400000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("guildId")
);

ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "VoiceSession" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "UserInventory" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "ScheduledSquad" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "ScheduledSquadAttendee" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "SquadBlacklist" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "ReputationParticipant" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "ReputationVote" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "PurchaseLedger" ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';

DROP INDEX IF EXISTS "UserProfile_discordId_key";
DROP INDEX IF EXISTS "UserInventory_userId_itemId_key";
DROP INDEX IF EXISTS "ScheduledSquadAttendee_scheduledSquadId_userId_key";
DROP INDEX IF EXISTS "SquadBlacklist_squadId_userId_key";
DROP INDEX IF EXISTS "ReputationParticipant_squadId_userId_key";
DROP INDEX IF EXISTS "ReputationVote_squadId_voterId_targetId_type_key";
DROP INDEX IF EXISTS "PurchaseLedger_userId_requestId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_guildId_discordId_key" ON "UserProfile"("guildId", "discordId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserInventory_guildId_userId_itemId_key" ON "UserInventory"("guildId", "userId", "itemId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledSquadAttendee_guildId_scheduledSquadId_userId_key" ON "ScheduledSquadAttendee"("guildId", "scheduledSquadId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "SquadBlacklist_guildId_squadId_userId_key" ON "SquadBlacklist"("guildId", "squadId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReputationParticipant_guildId_squadId_userId_key" ON "ReputationParticipant"("guildId", "squadId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReputationVote_guildId_squadId_voterId_targetId_type_key" ON "ReputationVote"("guildId", "squadId", "voterId", "targetId", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseLedger_guildId_userId_requestId_key" ON "PurchaseLedger"("guildId", "userId", "requestId");

CREATE INDEX IF NOT EXISTS "UserProfile_guildId_idx" ON "UserProfile"("guildId");
CREATE INDEX IF NOT EXISTS "VoiceSession_guildId_userId_active_idx" ON "VoiceSession"("guildId", "userId", "active");
CREATE INDEX IF NOT EXISTS "UserInventory_guildId_userId_idx" ON "UserInventory"("guildId", "userId");
CREATE INDEX IF NOT EXISTS "ScheduledSquad_guildId_scheduledTime_status_idx" ON "ScheduledSquad"("guildId", "scheduledTime", "status");
CREATE INDEX IF NOT EXISTS "ReputationParticipant_guildId_squadId_expiresAt_idx" ON "ReputationParticipant"("guildId", "squadId", "expiresAt");
CREATE INDEX IF NOT EXISTS "PurchaseLedger_guildId_userId_createdAt_idx" ON "PurchaseLedger"("guildId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Squad_guildId_gameId_status_idx" ON "Squad"("guildId", "gameId", "status");

INSERT INTO "GuildConfig" ("guildId")
SELECT DISTINCT "guildId" FROM "Game"
ON CONFLICT ("guildId") DO NOTHING;
