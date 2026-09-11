-- Integrity reconciliation for guild-scoped relations and voice-session history.
-- Legacy Discord IDs remain intentionally unreferenced: SquadMember.userId,
-- Squad.ownerId, ReputationParticipant.userId, ReputationVote.voterId and
-- ReputationVote.targetId store Discord IDs, while UserProfile.id is an internal ID.

-- Preserve historical sessions before the Prisma CASCADE removes the squad link.
CREATE OR REPLACE FUNCTION "preserve_voice_session_history_before_squad_delete"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "VoiceSession"
  SET "active" = false,
      "endedAt" = COALESCE("endedAt", CURRENT_TIMESTAMP),
      "squadId" = NULL
  WHERE "guildId" = OLD."guildId" AND "squadId" = OLD."id";
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "Squad_preserve_voice_session_history" ON "Squad";
CREATE TRIGGER "Squad_preserve_voice_session_history"
BEFORE DELETE ON "Squad"
FOR EACH ROW
EXECUTE FUNCTION "preserve_voice_session_history_before_squad_delete"();

ALTER TABLE "VoiceSession"
  DROP CONSTRAINT IF EXISTS "VoiceSession_guildId_squadId_fkey";
ALTER TABLE "VoiceSession"
  ADD CONSTRAINT "VoiceSession_guildId_squadId_fkey"
  FOREIGN KEY ("guildId", "squadId") REFERENCES "Squad"("guildId", "id")
  ON DELETE CASCADE NOT VALID;

-- Keep the newest active row and close older duplicates from the legacy database.
WITH duplicates AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY "guildId", "userId"
           ORDER BY "startedAt" DESC, "id" DESC
         ) AS row_number
  FROM "VoiceSession"
  WHERE "active" = true
)
UPDATE "VoiceSession" AS session
SET "active" = false, "endedAt" = COALESCE(session."endedAt", CURRENT_TIMESTAMP)
FROM duplicates
WHERE session.ctid = duplicates.ctid AND duplicates.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "VoiceSession_one_active_per_guild_user_key"
  ON "VoiceSession" ("guildId", "userId")
  WHERE "active" = true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Squad_guildId_ownerId_fkey') THEN
    ALTER TABLE "Squad" ADD CONSTRAINT "Squad_guildId_ownerId_fkey"
      FOREIGN KEY ("guildId", "ownerId") REFERENCES "UserProfile"("guildId", "discordId")
      NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduledSquadAttendee_guildId_scheduledSquadId_fkey') THEN
    ALTER TABLE "ScheduledSquadAttendee" ADD CONSTRAINT "ScheduledSquadAttendee_guildId_scheduledSquadId_fkey"
      FOREIGN KEY ("guildId", "scheduledSquadId") REFERENCES "ScheduledSquad"("guildId", "id")
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ScheduledSquadAttendee_guildId_userId_fkey') THEN
    ALTER TABLE "ScheduledSquadAttendee" ADD CONSTRAINT "ScheduledSquadAttendee_guildId_userId_fkey"
      FOREIGN KEY ("guildId", "userId") REFERENCES "UserProfile"("guildId", "id")
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReputationParticipant_guildId_squadId_fkey') THEN
    ALTER TABLE "ReputationParticipant" ADD CONSTRAINT "ReputationParticipant_guildId_squadId_fkey"
      FOREIGN KEY ("guildId", "squadId") REFERENCES "Squad"("guildId", "id")
      ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReputationVote_guildId_squadId_fkey') THEN
    ALTER TABLE "ReputationVote" ADD CONSTRAINT "ReputationVote_guildId_squadId_fkey"
      FOREIGN KEY ("guildId", "squadId") REFERENCES "Squad"("guildId", "id")
      ON DELETE CASCADE NOT VALID;
  END IF;
END
$$;
