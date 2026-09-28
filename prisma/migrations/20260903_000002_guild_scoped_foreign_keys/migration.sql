-- Tenant-aware keys protect new writes without rewriting legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS "Game_guildId_id_key" ON "Game"("guildId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "Squad_guildId_id_key" ON "Squad"("guildId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_guildId_id_key" ON "UserProfile"("guildId", "id");

ALTER TABLE "Squad" ADD CONSTRAINT "Squad_guildId_gameId_fkey"
  FOREIGN KEY ("guildId", "gameId") REFERENCES "Game"("guildId", "id") NOT VALID;
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_guildId_squadId_fkey"
  FOREIGN KEY ("guildId", "squadId") REFERENCES "Squad"("guildId", "id") NOT VALID;
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_guildId_squadId_fkey"
  FOREIGN KEY ("guildId", "squadId") REFERENCES "Squad"("guildId", "id") NOT VALID;
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_guildId_userId_fkey"
  FOREIGN KEY ("guildId", "userId") REFERENCES "UserProfile"("guildId", "id") NOT VALID;
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_guildId_userId_fkey"
  FOREIGN KEY ("guildId", "userId") REFERENCES "UserProfile"("guildId", "id") NOT VALID;
ALTER TABLE "ScheduledSquad" ADD CONSTRAINT "ScheduledSquad_guildId_creatorId_fkey"
  FOREIGN KEY ("guildId", "creatorId") REFERENCES "UserProfile"("guildId", "id") NOT VALID;
ALTER TABLE "SquadBlacklist" ADD CONSTRAINT "SquadBlacklist_guildId_squadId_fkey"
  FOREIGN KEY ("guildId", "squadId") REFERENCES "Squad"("guildId", "id") NOT VALID;
ALTER TABLE "SquadBlacklist" ADD CONSTRAINT "SquadBlacklist_guildId_userId_fkey"
  FOREIGN KEY ("guildId", "userId") REFERENCES "UserProfile"("guildId", "id") NOT VALID;
ALTER TABLE "SquadBlacklist" ADD CONSTRAINT "SquadBlacklist_guildId_creatorId_fkey"
  FOREIGN KEY ("guildId", "creatorId") REFERENCES "UserProfile"("guildId", "id") NOT VALID;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_guildId_actorId_fkey"
  FOREIGN KEY ("guildId", "actorId") REFERENCES "UserProfile"("guildId", "id") NOT VALID;