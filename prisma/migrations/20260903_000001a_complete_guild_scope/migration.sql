-- Complete guild scoping for legacy tables before the composite foreign keys
-- in 20260903_000002 are created. Existing rows belong to the explicit legacy
-- tenant; newer rows provide their guildId at insertion time.
ALTER TABLE "SquadMember"
  ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "guildId" TEXT NOT NULL DEFAULT 'legacy';

-- Composite FK targets must have a matching unique key before later migrations
-- can safely add tenant-scoped references.
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledSquad_guildId_id_key"
  ON "ScheduledSquad"("guildId", "id");
