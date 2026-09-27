-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL DEFAULT 'legacy',
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "shogunCoins" INTEGER NOT NULL DEFAULT 0,
    "ranks" JSONB NOT NULL DEFAULT '{}',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "ggCount" INTEGER NOT NULL DEFAULT 0,
    "honorCount" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "squadId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "minutesAwarded" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "clientId" TEXT,
    "channelName" TEXT,
    "chatChannelId" TEXT,
    "announceChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL DEFAULT 'legacy',
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "minRank" TEXT,
    "maxRank" TEXT,
    "voiceChannelId" TEXT,
    "textChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSquad" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT NOT NULL,
    "minElo" TEXT,
    "maxElo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "discordEventId" TEXT,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledSquad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSquadAttendee" (
    "id" TEXT NOT NULL,
    "scheduledSquadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ScheduledSquadAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadBlacklist" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationParticipant" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationVote" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLedger" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_guildId_name_key" ON "Game"("guildId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_discordId_key" ON "UserProfile"("discordId");

-- CreateIndex
CREATE INDEX "VoiceSession_userId_active_idx" ON "VoiceSession"("userId", "active");

-- CreateIndex
CREATE INDEX "VoiceSession_squadId_active_idx" ON "VoiceSession"("squadId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "UserInventory_userId_itemId_key" ON "UserInventory"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchConfig_guildId_key" ON "TwitchConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_voiceChannelId_key" ON "Squad"("voiceChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_textChannelId_key" ON "Squad"("textChannelId");

-- CreateIndex
CREATE INDEX "Squad_gameId_idx" ON "Squad"("gameId");

-- CreateIndex
CREATE INDEX "Squad_guildId_idx" ON "Squad"("guildId");

-- CreateIndex
CREATE INDEX "Squad_lastActivityAt_idx" ON "Squad"("lastActivityAt");

-- CreateIndex
CREATE INDEX "SquadMember_userId_idx" ON "SquadMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadMember_squadId_userId_key" ON "SquadMember"("squadId", "userId");

-- CreateIndex
CREATE INDEX "ScheduledSquad_scheduledTime_status_idx" ON "ScheduledSquad"("scheduledTime", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledSquadAttendee_scheduledSquadId_userId_key" ON "ScheduledSquadAttendee"("scheduledSquadId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SquadBlacklist_squadId_userId_key" ON "SquadBlacklist"("squadId", "userId");

-- CreateIndex
-- CreateIndex
CREATE INDEX "ReputationParticipant_squadId_expiresAt_idx" ON "ReputationParticipant"("squadId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationParticipant_squadId_userId_key" ON "ReputationParticipant"("squadId", "userId");

-- CreateIndex
CREATE INDEX "ReputationVote_squadId_voterId_idx" ON "ReputationVote"("squadId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "ReputationVote_squadId_voterId_targetId_type_key" ON "ReputationVote"("squadId", "voterId", "targetId", "type");

-- CreateIndex
CREATE INDEX "PurchaseLedger_userId_createdAt_idx" ON "PurchaseLedger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLedger_userId_requestId_key" ON "PurchaseLedger"("userId", "requestId");

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSquad" ADD CONSTRAINT "ScheduledSquad_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSquadAttendee" ADD CONSTRAINT "ScheduledSquadAttendee_scheduledSquadId_fkey" FOREIGN KEY ("scheduledSquadId") REFERENCES "ScheduledSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadBlacklist" ADD CONSTRAINT "SquadBlacklist_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadBlacklist" ADD CONSTRAINT "SquadBlacklist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadBlacklist" ADD CONSTRAINT "SquadBlacklist_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
