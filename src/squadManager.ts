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
} from 'discord.js';
import { PrismaClient } from '@prisma/client';

const MAX_SQUADS_PER_GAME = Number(process.env.MAX_SQUADS_PER_GAME ?? 10);
const MAX_MEMBERS_PER_SQUAD = Number(process.env.MAX_MEMBERS_PER_SQUAD ?? 15);
const TEMP_CATEGORY_NAME = process.env.TEMP_CATEGORY_NAME ?? '⚔️ │ SQUADS TEMPORÁRIAS';
const SQUADS_CATEGORY_ID = process.env.SQUADS_CATEGORY_ID;
const SQUAD_CREATION_CHANNEL_NAME = '➕ · Criar Squad';
const DYNAMIC_SQUAD_GAME_NAME = 'Squad Dinâmica';
const EMPTY_SQUAD_TIMEOUT_MS = 5 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const RANK_ORDER = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'ascendant', 'immortal', 'radiant', 'master', 'grandmaster', 'challenger'];

const LOBBY_TO_GAME: Record<string, string> = {
  '🌌 · Genshin Impact': 'Genshin Impact',
  '⚙️ · Arknights: Endfield': 'Arknights: Endfield',
  '🔥 · Diablo IV': 'Diablo IV',
  '💀 · Diablo III': 'Diablo III',
  '⛏️ · Minecraft': 'Minecraft',
  '🪓 · Terraria': 'Terraria',
};

export function isSquadCreationChannel(channelName: string | null, channelId: string | null, configuredChannelId = process.env.SQUADS_CREATE_VOICE_CHANNEL_ID): boolean {
  return channelName === SQUAD_CREATION_CHANNEL_NAME || Boolean(configuredChannelId && channelId === configuredChannelId);
}

export function getDynamicSquadChannelNames(userName: string): { voiceName: string; textName: string } {
  return {
    voiceName: `🔊 · Squad de ${userName}`,
    textName: `💬 · squad-de-${userName}`,
  };
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

  private async getOrCreateGame(guild: Guild, gameName: string) {
    const existing = await this.prisma.game.findUnique({ where: { guildId_name: { guildId: guild.id, name: gameName } } });

    if (existing) return existing;

    return this.prisma.game.create({
      data: {
        guildId: guild.id,
        name: gameName,
      },
    });
  }

  private async ensureTemporaryCategory(guild: Guild): Promise<GuildBasedChannel> {
    const configuredCategory = SQUADS_CATEGORY_ID ? guild.channels.cache.get(SQUADS_CATEGORY_ID) : undefined;
    if (configuredCategory?.type === ChannelType.GuildCategory) return configuredCategory;

    const existingCategory = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && channel.name === TEMP_CATEGORY_NAME,
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

  private async countActiveSquadsForGame(gameId: string): Promise<number> {
    return this.prisma.squad.count({
      where: {
        gameId,
        voiceChannelId: { not: null },
      },
    });
  }

  private async createTextChannel(guild: Guild, categoryId: string, channelName: string): Promise<TextChannel> {
    return guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: 'Squad temporária para a sessão criada automaticamente.',
    });
  }

  private async createVoiceChannel(guild: Guild, categoryId: string, squadName: string): Promise<VoiceChannel> {
    return guild.channels.create({
      name: squadName,
      type: ChannelType.GuildVoice,
      parent: categoryId,
      userLimit: MAX_MEMBERS_PER_SQUAD,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Speak],
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

  private async findActiveSquadForUser(userId: string, gameId: string) {
    return this.prisma.squad.findFirst({
      where: {
        gameId,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: true,
      },
    });
  }

  private async createSquadForGame(memberId: string, guild: Guild, gameName: string, minRank?: string, maxRank?: string, channelNames?: { voiceName: string; textName: string }) {
    const game = await this.getOrCreateGame(guild, gameName);
    const activeSquads = await this.countActiveSquadsForGame(game.id);

    if (activeSquads >= MAX_SQUADS_PER_GAME) {
      throw new Error(`Limite de ${MAX_SQUADS_PER_GAME} squads simultâneas alcançado para ${gameName}.`);
    }

    const category = await this.ensureTemporaryCategory(guild);
    const squadName = channelNames?.voiceName ?? `${gameName} • Squad ${activeSquads + 1}`;

    const voiceChannel = await this.createVoiceChannel(guild, category.id, squadName);
    const textChannel = await this.createTextChannel(guild, category.id, channelNames?.textName ?? `squad-${squadName}`);

    const squad = await this.prisma.squad.create({
      data: {
        guildId: guild.id,
        gameId: game.id,
        name: squadName,
        ownerId: memberId,
        minRank,
        maxRank,
        voiceChannelId: voiceChannel.id,
        textChannelId: textChannel.id,
        lastActivityAt: new Date(),
      },
    });

    await this.prisma.squadMember.create({
      data: {
        squadId: squad.id,
        userId: memberId,
      },
    });

    await textChannel.send({ content: `🛡️ Squad criada para ${gameName}. Voz: <#${voiceChannel.id}>. Chat: <#${textChannel.id}>. <@${memberId}> começou a sessão.`, allowedMentions: { parse: [] } });

    return { squad, voiceChannel, textChannel };
  }

  public async createManualSquad(memberId: string, guild: Guild, gameName: string, minRank?: string, maxRank?: string) {
    const activeSquad = await this.findActiveSquadForUser(memberId, (await this.getOrCreateGame(guild, gameName)).id);
    if (activeSquad) throw new Error('Você já está em uma squad ativa deste jogo.');
    return this.createSquadForGame(memberId, guild, gameName, minRank, maxRank);
  }

  private async createDynamicSquad(memberId: string, guild: Guild, userName: string) {
    const game = await this.getOrCreateGame(guild, DYNAMIC_SQUAD_GAME_NAME);
    const activeSquad = await this.findActiveSquadForUser(memberId, game.id);
    if (activeSquad) return null;

    return this.createSquadForGame(memberId, guild, DYNAMIC_SQUAD_GAME_NAME, undefined, undefined, getDynamicSquadChannelNames(userName));
  }

  private async deleteSquadRecord(guild: Guild, squadId: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      include: { members: true },
    });

    if (!squad) return;

    const voiceChannel = squad.voiceChannelId
      ? (guild.channels.cache.get(squad.voiceChannelId) as VoiceChannel | undefined)
      : undefined;
    const textChannel = squad.textChannelId
      ? (guild.channels.cache.get(squad.textChannelId) as TextChannel | undefined)
      : undefined;

    if (voiceChannel && 'delete' in voiceChannel && voiceChannel.deletable) {
      await voiceChannel.delete('Squad expirada').catch(() => undefined);
    }

    if (textChannel && 'delete' in textChannel && textChannel.deletable) {
      await textChannel.delete('Squad expirada').catch(() => undefined);
    }

    await this.prisma.squadMember.deleteMany({ where: { squadId } });
    await this.prisma.voiceSession.updateMany({ where: { squadId, active: true }, data: { active: false, endedAt: new Date() } });
    await this.prisma.squad.delete({ where: { id: squadId } });

    const timer = this.cleanupTimers.get(squad.voiceChannelId ?? squadId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(squad.voiceChannelId ?? squadId);
    }
  }

  private scheduleEmptySquadCleanup(guild: Guild, squadId: string, voiceChannelId: string) {
    if (this.cleanupTimers.has(voiceChannelId)) return;

    const timer = setTimeout(async () => {
      const squad = await this.prisma.squad.findUnique({
        where: { id: squadId },
        include: { members: true },
      });

      const channel = guild.channels.cache.get(voiceChannelId);
      if (squad && channel && channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
        await this.deleteSquadRecord(guild, squadId);
      }

      this.cleanupTimers.delete(voiceChannelId);
    }, EMPTY_SQUAD_TIMEOUT_MS);

    this.cleanupTimers.set(voiceChannelId, timer);
  }

  private async runCleanupChecks() {
    const squads = await this.prisma.squad.findMany({
      include: { members: true },
    });

    for (const squad of squads) {
      const now = Date.now();
      const lastActivity = new Date(squad.lastActivityAt).getTime();
      const inactivityReached = now - lastActivity >= INACTIVITY_TIMEOUT_MS;

      if (inactivityReached) {
        const guild = this.client.guilds.cache.find((candidate) =>
          candidate.channels.cache.has(squad.voiceChannelId ?? '') ||
          candidate.channels.cache.has(squad.textChannelId ?? ''),
        );

        if (guild) {
          await this.deleteSquadRecord(guild, squad.id);
        }
        continue;
      }

      if (!squad.voiceChannelId) continue;

      const guild = this.client.guilds.cache.find((candidate) => candidate.channels.cache.has(squad.voiceChannelId ?? ''));
      if (!guild) continue;

      const channel = guild.channels.cache.get(squad.voiceChannelId);
      if (channel && channel.type === ChannelType.GuildVoice && channel.members.size === 0) {
        this.scheduleEmptySquadCleanup(guild, squad.id, squad.voiceChannelId);
      }
    }
  }

  private async restoreExistingSquads() {
    const squads = await this.prisma.squad.findMany({ include: { members: true } });

    for (const squad of squads) {
      const guild = this.client.guilds.cache.find((candidate) =>
        candidate.channels.cache.has(squad.voiceChannelId ?? '') ||
        candidate.channels.cache.has(squad.textChannelId ?? ''),
      );

      if (!guild) {
        await this.prisma.squadMember.deleteMany({ where: { squadId: squad.id } });
        await this.prisma.squad.delete({ where: { id: squad.id } });
        continue;
      }

      const voiceChannel = squad.voiceChannelId ? guild.channels.cache.get(squad.voiceChannelId) : null;
      const textChannel = squad.textChannelId ? guild.channels.cache.get(squad.textChannelId) : null;

      if (!voiceChannel || !textChannel) {
        await this.prisma.squadMember.deleteMany({ where: { squadId: squad.id } });
        await this.prisma.squad.delete({ where: { id: squad.id } });
        continue;
      }

      if (voiceChannel.type === ChannelType.GuildVoice && voiceChannel.members.size === 0) {
        this.scheduleEmptySquadCleanup(guild, squad.id, squad.voiceChannelId!);
      }
    }
  }

  private async createMemberEntryIfNeeded(userId: string, squadId: string) {
    const exists = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    if (!exists) {
      await this.prisma.squadMember.create({
        data: {
          squadId,
          userId,
        },
      });
    }
  }

  private rankValue(rank: string | undefined): number {
    if (!rank) return -1;
    const normalized = rank.toLowerCase();
    const index = RANK_ORDER.findIndex((value) => normalized.includes(value));
    return index;
  }

  private async validateSquadEntry(userId: string, squad: { id: string; game: { name: string }; minRank: string | null; maxRank: string | null }) {
    const profile = await this.prisma.userProfile.findUnique({ where: { discordId: userId } });
    if (!profile) return { allowed: !squad.minRank && !squad.maxRank, message: 'Configure seu elo com /profile set-rank antes de entrar.' };
    const blacklisted = await this.prisma.squadBlacklist.findUnique({ where: { squadId_userId: { squadId: squad.id, userId: profile.id } } });
    if (blacklisted) return { allowed: false, message: 'Você está banido desta squad.' };
    const ranks = (profile.ranks && typeof profile.ranks === 'object' ? profile.ranks : {}) as Record<string, string>;
    const rank = ranks[squad.game.name.toLowerCase()] ?? ranks[squad.game.name] ?? undefined;
    const value = this.rankValue(rank);
    if (squad.minRank && value < this.rankValue(squad.minRank)) return { allowed: false, message: `Seu elo precisa ser pelo menos ${squad.minRank}.` };
    if (squad.maxRank && value > this.rankValue(squad.maxRank)) return { allowed: false, message: `Seu elo não pode superar ${squad.maxRank}.` };
    return { allowed: true, message: '' };
  }

  public async handleMessageCreate(message: Message) {
    if (message.author.bot) return;

    const squad = await this.prisma.squad.findFirst({
      where: { textChannelId: message.channel.id, guildId: message.guildId ?? undefined },
    });

    if (!squad) return;

    await this.updateSquadActivity(squad.id);
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const guild = newState.guild;

    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const oldSquad = await this.findSquadByVoiceChannel(oldState.channelId, guild.id);

      if (oldSquad) {
        await this.updateSquadActivity(oldSquad.id);

        const currentVoiceChannel = guild.channels.cache.get(oldState.channelId);
        if (currentVoiceChannel && currentVoiceChannel.type === ChannelType.GuildVoice && currentVoiceChannel.members.size === 0) {
          if (oldSquad.game.name === DYNAMIC_SQUAD_GAME_NAME) {
            await this.deleteSquadRecord(guild, oldSquad.id);
          } else {
            this.scheduleEmptySquadCleanup(guild, oldSquad.id, oldState.channelId);
          }
        }
      }
    }

    if (!newState.channel) return;

    if (isSquadCreationChannel(newState.channel.name, newState.channel.id)) {
      if (this.dynamicCreationsInFlight.has(member.id)) return;
      this.dynamicCreationsInFlight.add(member.id);
      try {
        const created = await this.createDynamicSquad(member.id, guild, member.displayName || member.user.username);
        if (created) await member.voice.setChannel(created.voiceChannel);
      } finally {
        this.dynamicCreationsInFlight.delete(member.id);
      }
      return;
    }

    if (this.isLobbyChannel(newState.channel.name)) {
      const gameName = this.getGameNameFromLobby(newState.channel.name);
      if (!gameName) return;

      const activeSquad = await this.findActiveSquadForUser(member.id, (await this.getOrCreateGame(guild, gameName)).id);
      if (activeSquad) return;

      const squadCount = await this.countActiveSquadsForGame((await this.getOrCreateGame(guild, gameName)).id);
      if (squadCount >= MAX_SQUADS_PER_GAME) {
        await member.send(`⚠️ O limite de ${MAX_SQUADS_PER_GAME} squads simultâneas para ${gameName} foi atingido.`);
        return;
      }

      const created = await this.createSquadForGame(member.id, guild, gameName);
      await member.voice.setChannel(created.voiceChannel);
      return;
    }

    const squad = await this.findSquadByVoiceChannel(newState.channel.id, guild.id);
    if (!squad) return;

    const entry = await this.validateSquadEntry(member.id, squad);
    if (!entry.allowed) {
      await member.voice.disconnect('Entrada recusada pela squad');
      await member.send(`⚠️ Entrada recusada: ${entry.message}`).catch(() => undefined);
      return;
    }

    if (squad.members.length >= MAX_MEMBERS_PER_SQUAD) {
      await member.voice.disconnect();
      await member.send(`⚠️ A squad ${squad.name} já atingiu o limite de ${MAX_MEMBERS_PER_SQUAD} membros.`);
      return;
    }

    await this.createMemberEntryIfNeeded(member.id, squad.id);
    await this.updateSquadActivity(squad.id);
  }
}
