import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { ChannelType } from "discord.js";
import { writeAudit } from "../src/commands/adminCommands.js";
import { COUNTED_SQUAD_STATUSES, SquadManager } from "../src/squadManager.js";
import { multiGuildFixture } from "./fixtures/multiguild.js";
import { isEphemeralTestDatabaseUrl } from "./support/ephemeral-db-url.js";
import { FakeDiscordAdapter } from "./support/fake-discord.js";

const isolatedTestDatabase = process.env.AIOX_TEST_DATABASE === "ephemeral";
const databaseUrl = isolatedTestDatabase ? process.env.DATABASE_URL : undefined;

if (!isolatedTestDatabase) {
  test.skip("PostgreSQL integration tests require the isolated test:integration harness");
} else {
  if (!databaseUrl) throw new Error("AIOX_TEST_DATABASE=ephemeral requires the disposable DATABASE_URL");
  if (!isEphemeralTestDatabaseUrl(databaseUrl)) throw new Error("Refusing integration tests: database URL is not the disposable test database");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  const makeObservedDiscordGuild = (
    guildId: string,
    adapter: FakeDiscordAdapter,
    isTransactionOpen: () => boolean,
  ) => {
    const category = {
      id: process.env.SQUADS_CATEGORY_ID ?? `${guildId}-category`,
      name: "⚔️ │ SQUADS TEMPORÁRIAS",
      type: ChannelType.GuildCategory,
    };
    const channels = new Map([[category.id, category]]);
    const guild = {
      id: guildId,
      roles: { everyone: { id: `${guildId}-everyone` } },
      channels: {
        cache: {
          get: (id: string) => channels.get(id),
          find: (predicate: (channel: (typeof category) & Record<string, unknown>) => boolean) =>
            [...channels.values()].find((channel) => predicate(channel as (typeof category) & Record<string, unknown>)),
        },
        create: async (input: { name: string; type: ChannelType; parent?: string }) => {
          const created = await adapter.create({
            name: input.name,
            ownershipMarker: "test-owned",
            guildId,
          });
          const channel = {
            id: created.id,
            name: input.name,
            type: input.type,
            parentId: input.parent ?? null,
            deletable: true,
            members: { size: 0 },
            delete: async () => adapter.delete(created.id),
            send: async () => adapter.send(created.id, "test announcement"),
            observedTransactionOpen: isTransactionOpen(),
          };
          channels.set(channel.id, channel);
          return channel;
        },
      },
    };
    return guild;
  };

  const prepareProductionIntegrityInvariants = async () => {
    // db push does not execute raw SQL from migrations; keep these production
    // invariants explicit in the integration database setup.
    await prisma.$executeRaw`
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
    `;
    await prisma.$executeRaw`
      DROP TRIGGER IF EXISTS "Squad_preserve_voice_session_history" ON "Squad";
    `;
    await prisma.$executeRaw`
      CREATE TRIGGER "Squad_preserve_voice_session_history"
      BEFORE DELETE ON "Squad"
      FOR EACH ROW
      EXECUTE FUNCTION "preserve_voice_session_history_before_squad_delete"();
    `;
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "VoiceSession_one_active_per_guild_user_key"
      ON "VoiceSession" ("guildId", "userId")
      WHERE "active" = true;
    `;
  };

  const requireDatabase = async () => {
    // In explicit integration mode, unavailable PostgreSQL is a failure. A
    // configured harness must never turn a broken connection into green skips.
    await prisma.$queryRaw`SELECT 1`;
    await prepareProductionIntegrityInvariants();
  };

  test.after(async () => {
    await prisma.$disconnect();
  });

  test("keeps squad membership scoped to its guild", async () => {
    await requireDatabase();
    const suffix = `test-${Date.now()}`;
    const guildA = `${suffix}-a`;
    const guildB = `${suffix}-b`;
    const discordId = `${suffix}-user`;

    try {
      const [profileA, profileB] = await Promise.all([
        prisma.userProfile.create({ data: { guildId: guildA, discordId } }),
        prisma.userProfile.create({ data: { guildId: guildB, discordId } }),
      ]);
      const [gameA, gameB] = await Promise.all([
        prisma.game.create({ data: { guildId: guildA, name: "Game" } }),
        prisma.game.create({ data: { guildId: guildB, name: "Game" } }),
      ]);
      const [squadA, squadB] = await Promise.all([
        prisma.squad.create({
          data: {
            guildId: guildA,
            gameId: gameA.id,
            name: "A",
            ownerId: discordId,
          },
        }),
        prisma.squad.create({
          data: {
            guildId: guildB,
            gameId: gameB.id,
            name: "B",
            ownerId: discordId,
          },
        }),
      ]);
      await Promise.all([
        prisma.squadMember.create({
          data: { guildId: guildA, squadId: squadA.id, userId: discordId },
        }),
        prisma.squadMember.create({
          data: { guildId: guildB, squadId: squadB.id, userId: discordId },
        }),
      ]);

      const membersA = await prisma.squadMember.findMany({
        where: { guildId: guildA, userId: discordId },
      });
      assert.deepEqual(
        membersA.map((member) => member.squadId),
        [squadA.id],
      );
      assert.notEqual(profileA.id, profileB.id);
    } finally {
      await prisma.squadMember.deleteMany({
        where: { guildId: { in: [guildA, guildB] } },
      });
      await prisma.squad.deleteMany({
        where: { guildId: { in: [guildA, guildB] } },
      });
      await prisma.game.deleteMany({
        where: { guildId: { in: [guildA, guildB] } },
      });
      await prisma.userProfile.deleteMany({
        where: { guildId: { in: [guildA, guildB] } },
      });
      await prisma.guildConfig.deleteMany({
        where: { guildId: { in: [guildA, guildB] } },
      });
    }
  });

  test("B0.5-01: fixed two-guild fixture reads and mutates only the explicit tenant", async () => {
    await requireDatabase();
    const guildA = multiGuildFixture.guilds.a.id;
    const guildB = multiGuildFixture.guilds.b.id;
    const actorsA = [
      multiGuildFixture.actors.shared,
      multiGuildFixture.actors.ownerA,
      multiGuildFixture.actors.staffA,
      multiGuildFixture.actors.memberA,
      multiGuildFixture.actors.outsider,
      multiGuildFixture.actors.exMember,
    ];
    const actorsB = [
      multiGuildFixture.actors.shared,
      multiGuildFixture.actors.ownerB,
      multiGuildFixture.actors.staffB,
      multiGuildFixture.actors.memberB,
    ];

    const cleanFixture = async () => {
      await prisma.squadMember.deleteMany({ where: { guildId: { in: [guildA, guildB] } } });
      await prisma.squad.deleteMany({ where: { guildId: { in: [guildA, guildB] } } });
      await prisma.game.deleteMany({ where: { guildId: { in: [guildA, guildB] } } });
      await prisma.userProfile.deleteMany({ where: { guildId: { in: [guildA, guildB] } } });
      await prisma.guildConfig.deleteMany({ where: { guildId: { in: [guildA, guildB] } } });
    };

    await cleanFixture();
    try {
      await Promise.all([
        prisma.guildConfig.create({ data: {
          guildId: guildA,
          maxSquadsPerGame: multiGuildFixture.guilds.a.maxSquadsPerGame,
          maxMembersPerSquad: multiGuildFixture.guilds.a.maxMembersPerSquad,
          emptySquadTimeoutMs: BigInt(multiGuildFixture.guilds.a.emptyTimeoutMs),
        } }),
        prisma.guildConfig.create({ data: {
          guildId: guildB,
          maxSquadsPerGame: multiGuildFixture.guilds.b.maxSquadsPerGame,
          maxMembersPerSquad: multiGuildFixture.guilds.b.maxMembersPerSquad,
          emptySquadTimeoutMs: BigInt(multiGuildFixture.guilds.b.emptyTimeoutMs),
        } }),
      ]);
      await Promise.all([
        ...actorsA.map((discordId) => prisma.userProfile.create({
          data: {
            guildId: guildA,
            discordId,
            shogunCoins: discordId === multiGuildFixture.actors.shared ? multiGuildFixture.community.guildA.sharedCoins : 0,
            reputationScore: discordId === multiGuildFixture.actors.shared ? multiGuildFixture.community.guildA.sharedReputation : 0,
            ranks: discordId === multiGuildFixture.actors.shared ? { Arena: multiGuildFixture.community.guildA.sharedRank } : {},
          },
        })),
        ...actorsB.map((discordId) => prisma.userProfile.create({
          data: {
            guildId: guildB,
            discordId,
            shogunCoins: discordId === multiGuildFixture.actors.shared ? multiGuildFixture.community.guildB.sharedCoins : 0,
            reputationScore: discordId === multiGuildFixture.actors.shared ? multiGuildFixture.community.guildB.sharedReputation : 0,
            ranks: discordId === multiGuildFixture.actors.shared ? { Arena: multiGuildFixture.community.guildB.sharedRank } : {},
          },
        })),
      ]);
      await Promise.all([
        prisma.game.create({ data: { guildId: guildA, name: multiGuildFixture.gameName } }),
        prisma.game.create({ data: { guildId: guildB, name: multiGuildFixture.gameName } }),
      ]);

      const sharedA = await prisma.userProfile.findFirstOrThrow({
        where: { guildId: guildA, discordId: multiGuildFixture.actors.shared },
      });
      const sharedB = await prisma.userProfile.findFirstOrThrow({
        where: { guildId: guildB, discordId: multiGuildFixture.actors.shared },
      });
      const resultA = await prisma.userProfile.findMany({
        where: { guildId: guildA, discordId: multiGuildFixture.actors.shared },
      });
      assert.equal(resultA.length, 1);
      assert.equal(resultA[0]?.id, sharedA.id);
      assert.notEqual(sharedA.id, sharedB.id);
      await prisma.userProfile.update({
        where: { guildId_id: { guildId: guildA, id: sharedA.id } },
        data: { shogunCoins: { increment: 1 } },
      });
      assert.equal((await prisma.userProfile.findUniqueOrThrow({ where: { id: sharedA.id } })).shogunCoins, 101);
      assert.equal((await prisma.userProfile.findUniqueOrThrow({ where: { id: sharedB.id } })).shogunCoins, 7);
      assert.equal(await prisma.game.count({ where: { guildId: guildA, name: "Arena" } }), 1);
      assert.equal(await prisma.game.count({ where: { guildId: guildB, name: "Arena" } }), 1);
    } finally {
      await cleanFixture();
    }
  });

  test("B0.5-02: migration adds guildId to pre-scope AuditLog and preserves the legacy tenant", async () => {
    await requireDatabase();
    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT "table_name", "column_name"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (("table_name" = 'AuditLog' AND "column_name" = 'guildId')
          OR ("table_name" = 'SquadMember' AND "column_name" = 'guildId'))
      ORDER BY "table_name"
    `;
    assert.deepEqual(columns, [
      { table_name: "AuditLog", column_name: "guildId" },
      { table_name: "SquadMember", column_name: "guildId" },
    ]);
    const scheduledSquadIndex = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'ScheduledSquad'
        AND indexname = 'ScheduledSquad_guildId_id_key'
    `;
    assert.deepEqual(scheduledSquadIndex, [{ indexname: "ScheduledSquad_guildId_id_key" }]);
    const probe = await prisma.$queryRaw<Array<{ guildId: string }>>`
      SELECT "guildId" FROM "AuditLog" WHERE "id" = 'story-0-5-legacy-audit'
    `;
    try {
      assert.deepEqual(probe, [{ guildId: "legacy" }]);
    } finally {
      await prisma.auditLog.deleteMany({ where: { id: "story-0-5-legacy-audit" } });
    }
  });

  test("preserves a historical voice session when its squad is deleted", async () => {
    await requireDatabase();
    const suffix = `test-${Date.now()}`;
    const guildId = `${suffix}-guild`;
    const discordId = `${suffix}-user`;

    try {
      const profile = await prisma.userProfile.create({
        data: { guildId, discordId },
      });
      const game = await prisma.game.create({
        data: { guildId, name: "Game" },
      });
      const squad = await prisma.squad.create({
        data: { guildId, gameId: game.id, name: "History", ownerId: discordId },
      });
      const session = await prisma.voiceSession.create({
        data: {
          guildId,
          userId: profile.id,
          squadId: squad.id,
          active: true,
        },
      });

      await prisma.squad.delete({ where: { id: squad.id } });

      const historical = await prisma.voiceSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(historical?.squadId, null);
      assert.equal(historical?.active, false);
      assert.ok(historical?.endedAt);
    } finally {
      await prisma.voiceSession.deleteMany({ where: { guildId } });
      await prisma.squad.deleteMany({ where: { guildId } });
      await prisma.game.deleteMany({ where: { guildId } });
      await prisma.userProfile.deleteMany({ where: { guildId } });
      await prisma.guildConfig.deleteMany({ where: { guildId } });
    }
  });

  test("allows at most one active voice session per guild user", async () => {
    await requireDatabase();
    const suffix = `test-${Date.now()}`;
    const guildId = `${suffix}-guild`;
    const discordId = `${suffix}-user`;

    try {
      const profile = await prisma.userProfile.create({
        data: { guildId, discordId },
      });
      const first = await prisma.voiceSession.create({
        data: { guildId, userId: profile.id },
      });
      await assert.rejects(
        prisma.voiceSession.create({ data: { guildId, userId: profile.id } }),
      );
      assert.equal(
        await prisma.voiceSession.count({
          where: { guildId, userId: profile.id, active: true },
        }),
        1,
      );
      await prisma.voiceSession.update({
        where: { id: first.id },
        data: { active: false },
      });
    } finally {
      await prisma.voiceSession.deleteMany({ where: { guildId } });
      await prisma.userProfile.deleteMany({ where: { guildId } });
      await prisma.guildConfig.deleteMany({ where: { guildId } });
    }
  });

  test("resolves Discord actors to guild-scoped UserProfile IDs for report and ban audits", async () => {
    await requireDatabase();
    const suffix = `test-${Date.now()}`;
    const guildId = `${suffix}-guild`;
    const actorDiscordId = `${suffix}-actor`;

    try {
      const profile = await prisma.userProfile.create({
        data: { guildId, discordId: actorDiscordId },
      });
      await writeAudit(
        prisma,
        guildId,
        actorDiscordId,
        "member_report",
        "target-report",
      );
      await writeAudit(
        prisma,
        guildId,
        actorDiscordId,
        "squad_ban",
        "target-ban",
      );

      const audits = await prisma.auditLog.findMany({
        where: { guildId },
        orderBy: { eventType: "asc" },
      });
      assert.deepEqual(
        audits.map((audit) => [audit.eventType, audit.actorId, audit.targetId]),
        [
          ["member_report", profile.id, "target-report"],
          ["squad_ban", profile.id, "target-ban"],
        ],
      );
    } finally {
      await prisma.auditLog.deleteMany({ where: { guildId } });
      await prisma.userProfile.deleteMany({ where: { guildId } });
    }
  });

  test("reserves active, provisioning, and pending squads in the same limit count", async () => {
    await requireDatabase();
    const suffix = `test-${Date.now()}`;
    const guildId = `${suffix}-guild`;

    try {
      const ownerIds = [
        ...COUNTED_SQUAD_STATUSES.map(
          (_, index) => `${suffix}-owner-${index}`,
        ),
        `${suffix}-owner-ended`,
      ];
      await prisma.userProfile.createMany({
        data: ownerIds.map((discordId) => ({ guildId, discordId })),
      });
      const game = await prisma.game.create({
        data: { guildId, name: "Game" },
      });
      await prisma.squad.createMany({
        data: COUNTED_SQUAD_STATUSES.map((status, index) => ({
          guildId,
          gameId: game.id,
          name: `${status}-${index}`,
          ownerId: `${suffix}-owner-${index}`,
          status,
        })),
      });
      await prisma.squad.create({
        data: {
          guildId,
          gameId: game.id,
          name: "ended",
          ownerId: `${suffix}-owner-ended`,
          status: "ended",
        },
      });

      assert.equal(
        await prisma.squad.count({
          where: {
            guildId,
            gameId: game.id,
            status: { in: [...COUNTED_SQUAD_STATUSES] },
          },
        }),
        COUNTED_SQUAD_STATUSES.length,
      );
    } finally {
      await prisma.squad.deleteMany({ where: { guildId } });
      await prisma.game.deleteMany({ where: { guildId } });
      await prisma.userProfile.deleteMany({ where: { guildId } });
    }
  });

  test("commits squad reservation before issuing any Discord effect", async () => {
    await requireDatabase();
    const suffix = `story-1-2-${Date.now()}`;
    const guildId = `${suffix}-guild`;
    const ownerId = `${suffix}-owner`;
    const discord = new FakeDiscordAdapter();
    const transactionStates: boolean[] = [];
    let transactionOpen = false;
    const observedPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === "$transaction") {
          return (callback: (transaction: unknown) => Promise<unknown>) =>
            target.$transaction(async (transaction) => {
              transactionOpen = true;
              try {
                return await callback(transaction);
              } finally {
                transactionOpen = false;
              }
            });
        }
        return Reflect.get(target, property, receiver);
      },
    }) as PrismaClient;
    const observedDiscord = new Proxy(discord, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          transactionStates.push(transactionOpen);
          return value.apply(target, args);
        };
      },
    });
    const guild = makeObservedDiscordGuild(
      guildId,
      observedDiscord,
      () => transactionOpen,
    );
    const client = { guilds: { cache: { get: () => guild } } };

    try {
      await prisma.userProfile.create({ data: { guildId, discordId: ownerId } });
      await new SquadManager(client as never, observedPrisma).createManualSquad(
        ownerId,
        guild as never,
        "TDD Boundary Game",
      );

      assert.ok(discord.calls.length > 0, "the scenario must exercise Discord effects");
      assert.ok(
        transactionStates.length >= 3 && transactionStates.every((open) => !open),
        "all Discord effects must happen after the T1 transaction commits",
      );
      assert.equal(
        await prisma.squad.count({ where: { guildId, status: "active" } }),
        1,
      );
    } finally {
      await prisma.squadMember.deleteMany({ where: { guildId } });
      await prisma.squad.deleteMany({ where: { guildId } });
      await prisma.game.deleteMany({ where: { guildId } });
      await prisma.userProfile.deleteMany({ where: { guildId } });
      await prisma.guildConfig.deleteMany({ where: { guildId } });
    }
  });

  test("startup reconciliation never deletes a controlled-looking channel without ownership proof", async () => {
    await requireDatabase();
    const guildId = `story-1-2-ownership-${Date.now()}`;
    let deleteCalls = 0;
    const category = {
      id: process.env.SQUADS_CATEGORY_ID ?? `${guildId}-category`,
      name: "⚔️ │ SQUADS TEMPORÁRIAS",
      type: ChannelType.GuildCategory,
    };
    const unknownChannel = {
      id: `${guildId}-unknown-channel`,
      name: "🔊 · Squad de jogador",
      type: ChannelType.GuildVoice,
      parentId: category.id,
      deletable: true,
      delete: async () => {
        deleteCalls += 1;
      },
    };
    const channels = new Map([
      [category.id, category],
      [unknownChannel.id, unknownChannel],
    ]);
    const cache = {
      get: (id: string) => channels.get(id),
      find: (predicate: (channel: any) => boolean) =>
        [...channels.values()].find(predicate),
      filter: (predicate: (channel: any) => boolean) =>
        new Map([...channels.entries()].filter(([, channel]) => predicate(channel))),
      values: () => channels.values(),
    };
    const guild = { id: guildId, channels: { cache } };
    const client = {
      guilds: { cache: { get: () => guild, values: () => [guild].values() } },
    };
    const manager = new SquadManager(client as never, prisma);

    await (manager as any).restoreExistingSquads();

    assert.equal(
      deleteCalls,
      0,
      "a matching channel name and cache location do not prove bot ownership",
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          guildId,
          targetId: unknownChannel.id,
          eventType: "orphan_controlled_channel_unverified",
        },
      }),
      1,
      "unverified candidates must leave an audit trail for operator review",
    );
  });

  test("startup cache misses retain the squad as pending reconciliation", async () => {
    await requireDatabase();
    const suffix = `story-1-2-cache-${Date.now()}`;
    const guildId = `${suffix}-guild`;
    const ownerId = `${suffix}-owner`;
    const squadId = `${suffix}-squad`;
    const categoryId = process.env.SQUADS_CATEGORY_ID ?? `${guildId}-category`;
    const category = {
      id: categoryId,
      name: "⚔️ │ SQUADS TEMPORÁRIAS",
      type: ChannelType.GuildCategory,
    };
    const channels = new Map([[category.id, category]]);
    const cache = {
      get: (id: string) => channels.get(id),
      find: (predicate: (channel: any) => boolean) =>
        [...channels.values()].find(predicate),
      filter: (predicate: (channel: any) => boolean) =>
        new Map([...channels.entries()].filter(([, channel]) => predicate(channel))),
      values: () => channels.values(),
    };
    const guild = { id: guildId, channels: { cache } };
    const client = {
      guilds: { cache: { get: (id: string) => (id === guildId ? guild : undefined), values: () => [guild].values() } },
    };

    try {
      await prisma.userProfile.create({ data: { guildId, discordId: ownerId } });
      const game = await prisma.game.create({ data: { guildId, name: "Cache Game" } });
      await prisma.squad.create({
        data: {
          id: squadId,
          guildId,
          gameId: game.id,
          name: "Cache fixture",
          ownerId,
          voiceChannelId: `${suffix}-voice`,
          textChannelId: `${suffix}-text`,
          status: "active",
        },
      });

      await (new SquadManager(client as never, prisma) as any).restoreExistingSquads();

      const reconciled = await prisma.squad.findFirst({ where: { id: squadId, guildId } });
      assert.equal(
        reconciled?.status,
        "pending_reconciliation",
        "cache absence is not proof that Discord resources are absent",
      );
    } finally {
      await prisma.auditLog.deleteMany({ where: { guildId } });
      await prisma.squadMember.deleteMany({ where: { guildId } });
      await prisma.squad.deleteMany({ where: { guildId } });
      await prisma.game.deleteMany({ where: { guildId } });
      await prisma.userProfile.deleteMany({ where: { guildId } });
      await prisma.guildConfig.deleteMany({ where: { guildId } });
    }
  });
}
