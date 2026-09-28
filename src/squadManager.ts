import {
  ChannelType,
  Client,
  Guild,
  GuildBasedChannel,
  Message,
  PermissionFlagsBits,
  TextChannel,
  VoiceChannel,
  VoiceState,
} from "discord.js";
import { Prisma, PrismaClient } from "@prisma/client";

const DEFAULT_MAX_SQUADS_PER_GAME = 10;
const DEFAULT_MAX_MEMBERS_PER_SQUAD = 15;
const TEMP_CATEGORY_NAME =
  process.env.TEMP_CATEGORY_NAME ?? "⚔️ │ SQUADS TEMPORÁRIAS";
const SQUADS_CATEGORY_ID = process.env.SQUADS_CATEGORY_ID;
const SQUAD_CREATION_CHANNEL_NAME = "➕ · Criar Squad";
const DYNAMIC_SQUAD_GAME_NAME = "Squad Dinâmica";
export const COUNTED_SQUAD_STATUSES = [
  "active",
  "provisioning",
  "pending_reconciliation",
] as const;
type DatabaseClient = PrismaClient | Prisma.TransactionClient;
const RANK_ORDER = [
  "iron",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "ascendant",
  "immortal",
  "radiant",
  "master",
  "grandmaster",
  "challenger",
];

const LOBBY_TO_GAME: Record<string, string> = {
  "🌌 · Genshin Impact": "Genshin Impact",
  "⚙️ · Arknights: Endfield": "Arknights: Endfield",
  "🔥 · Diablo IV": "Diablo IV",
  "💀 · Diablo III": "Diablo III",
  "⛏️ · Minecraft": "Minecraft",
  "🪓 · Terraria": "Terraria",
};

export function isSquadCreationChannel(
  channelName: string | null,
  channelId: string | null,
  configuredChannelId = process.env.SQUADS_CREATE_VOICE_CHANNEL_ID,
): boolean {
  return (
    channelName === SQUAD_CREATION_CHANNEL_NAME ||
    Boolean(configuredChannelId && channelId === configuredChannelId)
  );
}

export function getDynamicSquadChannelNames(userName: string): {
  voiceName: string;
  textName: string;
} {
  return {
    voiceName: `🔊 · Squad de ${userName}`,
    textName: `💬 · squad-de-${userName}`,
  };
}

export function isControlledSquadChannelName(
  channelType: ChannelType,
  channelName: string,
): boolean {
  return (
    (channelType === ChannelType.GuildVoice &&
      channelName.startsWith("🔊 · Squad de ")) ||
    (channelType === ChannelType.GuildText &&
      channelName.startsWith("💬 · squad-de-"))
  );
}

export class SquadManager {
  private started = false;
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();
  private readonly dynamicCreationsInFlight = new Set<string>();

  constructor(
    private readonly client: Client,
    private readonly prisma: PrismaClient,
  ) {}

  public async start() {
    if (this.started) return;
    this.started = true;
    await this.restoreExistingSquads();
    setInterval(() => {
      void this.runCleanupChecks();
    }, 60 * 1000);
  }

  private isLobbyChannel(channelName: string | null): boolean {
    if (!channelName) return false;
    return channelName in LOBBY_TO_GAME;
  }

  private getGameNameFromLobby(channelName: string): string | null {
    return LOBBY_TO_GAME[channelName] ?? null;
  }

  private async getOrCreateGame(
    guild: Guild,
    gameName: string,
    database: DatabaseClient = this.prisma,
  ) {
    const existing = await database.game.findUnique({
      where: { guildId_name: { guildId: guild.id, name: gameName } },
    });

    if (existing) return existing;

    return database.game.create({
      data: {
        guildId: guild.id,
        name: gameName,
      },
    });
  }

  private async getGuildConfig(
    guildId: string,
    database: DatabaseClient = this.prisma,
  ) {
    return database.guildConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        maxSquadsPerGame: DEFAULT_MAX_SQUADS_PER_GAME,
        maxMembersPerSquad: DEFAULT_MAX_MEMBERS_PER_SQUAD,
      },
      update: {},
    });
  }

  private async ensureTemporaryCategory(
    guild: Guild,
  ): Promise<GuildBasedChannel> {
    const configuredCategory = SQUADS_CATEGORY_ID
      ? guild.channels.cache.get(SQUADS_CATEGORY_ID)
      : undefined;
    if (configuredCategory?.type === ChannelType.GuildCategory)
      return configuredCategory;

    const existingCategory = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildCategory &&
        channel.name === TEMP_CATEGORY_NAME,
    );

    if (existingCategory) return existingCategory;

    return guild.channels.create({
      name: TEMP_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
  }

  private async countActiveSquadsForGame(
    guildId: string,
    gameId: string,
    database: DatabaseClient = this.prisma,
  ): Promise<number> {
    return database.squad.count({
      where: {
        guildId,
        gameId,
        status: { in: [...COUNTED_SQUAD_STATUSES] },
      },
    });
  }

  private async createTextChannel(
    guild: Guild,
    categoryId: string,
    channelName: string,
  ): Promise<TextChannel> {
    return guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: "Squad temporária para a sessão criada automaticamente.",
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });
  }

  private async createVoiceChannel(
    guild: Guild,
    categoryId: string,
    squadName: string,
    memberId: string,
    memberLimit: number,
  ): Promise<VoiceChannel> {
    return guild.channels.create({
      name: squadName,
      type: ChannelType.GuildVoice,
      parent: categoryId,
      userLimit: memberLimit,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: memberId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        },
      ],
    });
  }

  private async findSquadByVoiceChannel(channelId: string, guildId: string) {
    return this.prisma.squad.findFirst({
      where: { voiceChannelId: channelId, guildId },
      include: { members: true, game: true },
    });
  }

  private async updateSquadActivity(squadId: string) {
    await this.prisma.squad.update({
      where: { id: squadId },
      data: { lastActivityAt: new Date() },
    });
  }

  private async findActiveSquadForUser(
    userId: string,
    guildId: string,
    gameId: string,
  ) {
    return this.prisma.squad.findFirst({
      where: {
        guildId,
        gameId,
        status: "active",
        members: {
          some: {
            guildId,
            userId,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  private async persistProvisionedChannel(
    guildId: string,
    squadId: string,
    channel: "voiceChannelId" | "textChannelId",
    channelId: string,
  ) {
    const data =
      channel === "voiceChannelId"
        ? { voiceChannelId: channelId }
        : { textChannelId: channelId };
    await this.prisma.squad.update({
      where: { guildId_id: { guildId, id: squadId } },
      data,
    });
  }

  private async createSquadForGame(
    memberId: string,
    guild: Guild,
    gameName: string,
    minRank?: string,
    maxRank?: string,
    channelNames?: { voiceName: string; textName: string },
  ) {
    const { squad, maxMembersPerSquad, squadName } = await this.prisma.$transaction(async (transaction) => {
      // Return a scalar: Prisma cannot deserialize pg_advisory_xact_lock's void.
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${guild.id}:${gameName}`}, 0)) IS NULL`;
      const config = await this.getGuildConfig(guild.id, transaction);
      const game = await this.getOrCreateGame(guild, gameName, transaction);
      const alreadyMember = await transaction.squad.findFirst({
        where: {
          guildId: guild.id,
          gameId: game.id,
          status: "active",
          members: { some: { guildId: guild.id, userId: memberId } },
        },
        select: { id: true },
      });
      if (alreadyMember) {
        throw new Error("Você já está em uma squad ativa deste jogo.");
      }
      const activeSquads = await this.countActiveSquadsForGame(
        guild.id,
        game.id,
        transaction,
      );
      if (activeSquads >= config.maxSquadsPerGame) {
        throw new Error(
          `Limite de ${config.maxSquadsPerGame} squads simultâneas alcançado para ${gameName}.`,
        );
      }

      const squadName =
        channelNames?.voiceName ?? `${gameName} • Squad ${activeSquads + 1}`;
      const squad = await transaction.squad.create({
        data: {
          guildId: guild.id,
          gameId: game.id,
          name: squadName,
          ownerId: memberId,
          minRank,
          maxRank,
          status: "provisioning",
          lastActivityAt: new Date(),
        },
      });
      await transaction.squadMember.create({
        data: { guildId: guild.id, squadId: squad.id, userId: memberId },
      });
      return { squad, maxMembersPerSquad: config.maxMembersPerSquad, squadName };
    });

    // P2: Discord effects run after T1 commits. Persist every created resource
    // before issuing the next external effect so partial progress is recoverable.
    try {
      const category = await this.ensureTemporaryCategory(guild);
      const voiceChannel = await this.createVoiceChannel(
        guild,
        category.id,
        squadName,
        memberId,
        maxMembersPerSquad,
      );
      await this.persistProvisionedChannel(
        guild.id,
        squad.id,
        "voiceChannelId",
        voiceChannel.id,
      );

      const textChannel = await this.createTextChannel(
        guild,
        category.id,
        channelNames?.textName ?? `squad-${squadName}`,
      );
      await this.persistProvisionedChannel(
        guild.id,
        squad.id,
        "textChannelId",
        textChannel.id,
      );

      await textChannel.send({
        content: `🛡️ Squad criada para ${gameName}. Voz: <#${voiceChannel.id}>. Chat: <#${textChannel.id}>. <@${memberId}> começou a sessão.`,
        allowedMentions: { parse: [] },
      });

      // T3: finalize only after all P2 effects and their IDs are durable.
      const completedSquad = await this.prisma.squad.update({
        where: { guildId_id: { guildId: guild.id, id: squad.id } },
        data: { status: "active" },
      });
      return { squad: completedSquad, voiceChannel, textChannel };
    } catch (error) {
      await this.markSquadPendingReconciliation(guild.id, squad.id, {
        reason: "provisioning_effect_failed",
      });
      throw error;
    }
  }

  public async createManualSquad(
    memberId: string,
    guild: Guild,
    gameName: string,
    minRank?: string,
    maxRank?: string,
  ) {
    const activeSquad = await this.findActiveSquadForUser(
      memberId,
      guild.id,
      (await this.getOrCreateGame(guild, gameName)).id,
    );
    if (activeSquad)
      throw new Error("Você já está em uma squad ativa deste jogo.");
    return this.createSquadForGame(memberId, guild, gameName, minRank, maxRank);
  }

  private async createDynamicSquad(
    memberId: string,
    guild: Guild,
    userName: string,
  ) {
    const game = await this.getOrCreateGame(guild, DYNAMIC_SQUAD_GAME_NAME);
    const activeSquad = await this.findActiveSquadForUser(
      memberId,
      guild.id,
      game.id,
    );
    if (activeSquad) return null;

    return this.createSquadForGame(
      memberId,
      guild,
      DYNAMIC_SQUAD_GAME_NAME,
      undefined,
      undefined,
      getDynamicSquadChannelNames(userName),
    );
  }

  private async deleteSquadRecord(guild: Guild, squadId: string) {
    const squad = await this.prisma.squad.findFirst({
      where: { id: squadId, guildId: guild.id },
      include: { members: true },
    });

    if (!squad) return;

    const voiceChannel = squad.voiceChannelId
      ? (guild.channels.cache.get(squad.voiceChannelId) as
          | VoiceChannel
          | undefined)
      : undefined;
    const textChannel = squad.textChannelId
      ? (guild.channels.cache.get(squad.textChannelId) as
          | TextChannel
          | undefined)
      : undefined;

    if (voiceChannel && "delete" in voiceChannel && voiceChannel.deletable) {
      await voiceChannel.delete("Squad expirada").catch(() => undefined);
    }

    if (textChannel && "delete" in textChannel && textChannel.deletable) {
      await textChannel.delete("Squad expirada").catch(() => undefined);
    }

    await this.prisma.squadMember.deleteMany({
      where: { guildId: guild.id, squadId },
    });
    await this.prisma.voiceSession.updateMany({
      where: { guildId: guild.id, squadId, active: true },
      data: { active: false, endedAt: new Date() },
    });
    await this.prisma.auditLog
      .create({
        data: {
          guildId: guild.id,
          eventType: "squad_deleted",
          targetId: squadId,
          details: {
            reason: "expired_or_reconciled",
            voiceChannelId: squad.voiceChannelId,
            textChannelId: squad.textChannelId,
          },
        },
      })
      .catch(() => undefined);
    await this.prisma.squad.deleteMany({
      where: { id: squadId, guildId: guild.id },
    });

    const timer = this.cleanupTimers.get(squad.voiceChannelId ?? squadId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(squad.voiceChannelId ?? squadId);
    }
  }

  private async recordUnverifiedOrphanChannel(
    guildId: string,
    channelId: string,
    channelName: string,
  ) {
    await this.prisma.auditLog
      .create({
        data: {
          guildId,
          eventType: "orphan_controlled_channel_unverified",
          targetId: channelId,
          details: { channelName, reason: "ownership_not_proven" },
        },
      })
      .catch(() => undefined);
  }

  private async markSquadPendingReconciliation(
    guildId: string,
    squadId: string,
    details: Prisma.InputJsonObject,
  ) {
    await this.prisma.squad.updateMany({
      where: { guildId, id: squadId },
      data: { status: "pending_reconciliation" },
    });
    await this.prisma.auditLog
      .create({
        data: {
          guildId,
          eventType: "squad_pending_reconciliation",
          targetId: squadId,
          details,
        },
      })
      .catch(() => undefined);
  }

  private scheduleEmptySquadCleanup(
    guild: Guild,
    squadId: string,
    voiceChannelId: string,
    timeoutMs: number,
  ) {
    if (this.cleanupTimers.has(voiceChannelId)) return;

    const timer = setTimeout(async () => {
      const squad = await this.prisma.squad.findUnique({
        where: { id: squadId },
        include: { members: true },
      });

      const channel = guild.channels.cache.get(voiceChannelId);
      if (
        squad &&
        channel &&
        channel.type === ChannelType.GuildVoice &&
        channel.members.size === 0
      ) {
        await this.deleteSquadRecord(guild, squadId);
      }

      this.cleanupTimers.delete(voiceChannelId);
    }, timeoutMs);

    this.cleanupTimers.set(voiceChannelId, timer);
  }

  private async runCleanupChecks() {
    const squads = await this.prisma.squad.findMany({
      where: { status: "active" },
      include: { members: true },
    });

    for (const squad of squads) {
      const now = Date.now();
      const lastActivity = new Date(squad.lastActivityAt).getTime();
      const config = await this.getGuildConfig(squad.guildId);
      const inactivityReached =
        now - lastActivity >= Number(config.inactivityTimeoutMs);

      if (inactivityReached) {
        const guild = this.client.guilds.cache.get(squad.guildId);

        if (guild) {
          await this.deleteSquadRecord(guild, squad.id);
        }
        continue;
      }

      if (!squad.voiceChannelId) continue;

      const guild = this.client.guilds.cache.find((candidate) =>
        candidate.channels.cache.has(squad.voiceChannelId ?? ""),
      );
      if (!guild) continue;

      const channel = guild.channels.cache.get(squad.voiceChannelId);
      if (
        channel &&
        channel.type === ChannelType.GuildVoice &&
        channel.members.size === 0
      ) {
        this.scheduleEmptySquadCleanup(
          guild,
          squad.id,
          squad.voiceChannelId,
          Number(config.emptySquadTimeoutMs),
        );
      }
    }
  }

  private async restoreExistingSquads() {
    const squads = await this.prisma.squad.findMany({
      include: { members: true },
    });

    for (const squad of squads) {
      const guild = this.client.guilds.cache.get(squad.guildId);

      if (!guild) {
        await this.markSquadPendingReconciliation(
          squad.guildId,
          squad.id,
          { reason: "guild_not_in_cache" },
        );
        continue;
      }

      const voiceChannel = squad.voiceChannelId
        ? guild.channels.cache.get(squad.voiceChannelId)
        : null;
      const textChannel = squad.textChannelId
        ? guild.channels.cache.get(squad.textChannelId)
        : null;

      if (!voiceChannel || !textChannel) {
        await this.markSquadPendingReconciliation(
          squad.guildId,
          squad.id,
          {
            reason: "channel_missing_from_cache",
            voiceChannelId: squad.voiceChannelId,
            textChannelId: squad.textChannelId,
          },
        );
        continue;
      }

      if (
        voiceChannel.type === ChannelType.GuildVoice &&
        voiceChannel.members.size === 0
      ) {
        const config = await this.getGuildConfig(squad.guildId);
        this.scheduleEmptySquadCleanup(
          guild,
          squad.id,
          squad.voiceChannelId!,
          Number(config.emptySquadTimeoutMs),
        );
      }
    }

    for (const guild of this.client.guilds.cache.values()) {
      const category = SQUADS_CATEGORY_ID
        ? guild.channels.cache.get(SQUADS_CATEGORY_ID)
        : guild.channels.cache.find(
            (channel) =>
              channel.type === ChannelType.GuildCategory &&
              channel.name === TEMP_CATEGORY_NAME,
          );
      if (!category) continue;
      const controlledChannels = guild.channels.cache.filter(
        (channel) =>
          channel.parentId === category.id &&
          isControlledSquadChannelName(channel.type, channel.name),
      );
      const knownChannelIds = new Set(
        squads
          .filter((squad) => squad.guildId === guild.id)
          .flatMap((squad) =>
            [squad.voiceChannelId, squad.textChannelId].filter(
              (channelId): channelId is string => Boolean(channelId),
            ),
          ),
      );
      for (const channel of controlledChannels.values()) {
        if (knownChannelIds.has(channel.id)) continue;

        // Names and cache placement are not ownership proof. Keep the resource
        // intact until a persisted operation and an API fetch can establish it.
        await this.recordUnverifiedOrphanChannel(
          guild.id,
          channel.id,
          channel.name,
        );
      }
    }
  }

  private async createMemberEntryIfNeeded(
    userId: string,
    squadId: string,
    guildId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${guildId}:${squadId}`}, 0))`;
      const config = await this.getGuildConfig(guildId, transaction);
      const squad = await transaction.squad.findFirst({
        where: { id: squadId, guildId, status: "active" },
      });
      if (!squad) throw new Error("Esta squad não está mais disponível.");
      const exists = await transaction.squadMember.findUnique({
        where: { guildId_squadId_userId: { guildId, squadId, userId } },
      });
      if (exists) return exists;
      const memberCount = await transaction.squadMember.count({
        where: { guildId, squadId },
      });
      if (memberCount >= config.maxMembersPerSquad) {
        throw new Error(
          `A squad ${squad.name} já atingiu o limite de ${config.maxMembersPerSquad} membros.`,
        );
      }
      return transaction.squadMember.create({
        data: { guildId, squadId, userId },
      });
    });
  }

  private rankValue(rank: string | undefined): number {
    if (!rank) return -1;
    const normalized = rank.toLowerCase();
    const index = RANK_ORDER.findIndex((value) => normalized.includes(value));
    return index;
  }

  private async validateSquadEntry(
    userId: string,
    guildId: string,
    squad: {
      id: string;
      game: { name: string };
      minRank: string | null;
      maxRank: string | null;
    },
  ) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { guildId_discordId: { guildId, discordId: userId } },
    });
    if (!profile)
      return {
        allowed: !squad.minRank && !squad.maxRank,
        message: "Configure seu elo com /profile set-rank antes de entrar.",
      };
    const blacklisted = await this.prisma.squadBlacklist.findUnique({
      where: {
        guildId_squadId_userId: {
          guildId,
          squadId: squad.id,
          userId: profile.id,
        },
      },
    });
    if (blacklisted)
      return { allowed: false, message: "Você está banido desta squad." };
    const ranks = (
      profile.ranks && typeof profile.ranks === "object" ? profile.ranks : {}
    ) as Record<string, string>;
    const rank =
      ranks[squad.game.name.toLowerCase()] ??
      ranks[squad.game.name] ??
      undefined;
    const value = this.rankValue(rank);
    if (squad.minRank && value < this.rankValue(squad.minRank))
      return {
        allowed: false,
        message: `Seu elo precisa ser pelo menos ${squad.minRank}.`,
      };
    if (squad.maxRank && value > this.rankValue(squad.maxRank))
      return {
        allowed: false,
        message: `Seu elo não pode superar ${squad.maxRank}.`,
      };
    return { allowed: true, message: "" };
  }

  public async handleMessageCreate(message: Message) {
    if (message.author.bot) return;

    const squad = await this.prisma.squad.findFirst({
      where: {
        textChannelId: message.channel.id,
        guildId: message.guildId ?? undefined,
      },
    });

    if (!squad) return;

    await this.updateSquadActivity(squad.id);
  }

  public async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
  ) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const guild = newState.guild;

    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const oldSquad = await this.findSquadByVoiceChannel(
        oldState.channelId,
        guild.id,
      );

      if (oldSquad) {
        await this.updateSquadActivity(oldSquad.id);

        const currentVoiceChannel = guild.channels.cache.get(
          oldState.channelId,
        );
        if (
          currentVoiceChannel &&
          currentVoiceChannel.type === ChannelType.GuildVoice &&
          currentVoiceChannel.members.size === 0
        ) {
          if (oldSquad.game.name === DYNAMIC_SQUAD_GAME_NAME) {
            await this.deleteSquadRecord(guild, oldSquad.id);
          } else {
            this.scheduleEmptySquadCleanup(
              guild,
              oldSquad.id,
              oldState.channelId,
              Number((await this.getGuildConfig(guild.id)).emptySquadTimeoutMs),
            );
          }
        }
      }
    }

    if (!newState.channel) return;

    if (isSquadCreationChannel(newState.channel.name, newState.channel.id)) {
      const creationKey = `${guild.id}:${member.id}`;
      if (this.dynamicCreationsInFlight.has(creationKey)) return;
      this.dynamicCreationsInFlight.add(creationKey);
      try {
        const created = await this.createDynamicSquad(
          member.id,
          guild,
          member.displayName || member.user.username,
        );
        if (created) await member.voice.setChannel(created.voiceChannel);
      } finally {
        this.dynamicCreationsInFlight.delete(creationKey);
      }
      return;
    }

    if (this.isLobbyChannel(newState.channel.name)) {
      const gameName = this.getGameNameFromLobby(newState.channel.name);
      if (!gameName) return;

      const activeSquad = await this.findActiveSquadForUser(
        member.id,
        guild.id,
        (await this.getOrCreateGame(guild, gameName)).id,
      );
      if (activeSquad) return;

      try {
        const created = await this.createSquadForGame(
          member.id,
          guild,
          gameName,
        );
        await member.voice.setChannel(created.voiceChannel);
      } catch (error) {
        await member
          .send(
            error instanceof Error
              ? `⚠️ ${error.message}`
              : "⚠️ Não foi possível criar a squad.",
          )
          .catch(() => undefined);
      }
      return;
    }

    const squad = await this.findSquadByVoiceChannel(
      newState.channel.id,
      guild.id,
    );
    if (!squad) return;

    const entry = await this.validateSquadEntry(member.id, guild.id, squad);
    if (!entry.allowed) {
      await member.voice.disconnect("Entrada recusada pela squad");
      await member
        .send(`⚠️ Entrada recusada: ${entry.message}`)
        .catch(() => undefined);
      return;
    }

    try {
      await this.createMemberEntryIfNeeded(member.id, squad.id, guild.id);
    } catch (error) {
      await member.voice.disconnect();
      await member
        .send(
          error instanceof Error
            ? `⚠️ ${error.message}`
            : "⚠️ Não foi possível entrar na squad.",
        )
        .catch(() => undefined);
      return;
    }
    const voiceChannel = guild.channels.cache.get(squad.voiceChannelId ?? "");
    const textChannel = guild.channels.cache.get(squad.textChannelId ?? "");
    if (voiceChannel && "permissionOverwrites" in voiceChannel) {
      await voiceChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      });
    }
    if (textChannel?.isTextBased() && "permissionOverwrites" in textChannel) {
      await textChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
      });
    }
    await this.updateSquadActivity(squad.id);
  }
}
