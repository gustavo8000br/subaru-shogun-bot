import { Client, VoiceState } from "discord.js";
import { PrismaClient } from "@prisma/client";

const REWARD_INTERVAL_MINUTES = Number(
  process.env.VOICE_REWARD_INTERVAL_MINUTES ?? 10,
);
const COINS_PER_INTERVAL = Number(process.env.VOICE_COINS_PER_INTERVAL ?? 10);

export class VoiceEconomyService {
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly client: Client,
    private readonly prisma: PrismaClient,
  ) {}

  public start() {
    if (this.timer) return;
    this.timer = setInterval(
      () => void this.rewardActiveSessions(),
      REWARD_INTERVAL_MINUTES * 60 * 1000,
    );
  }

  public async handleVoiceStateUpdate(
    oldState: VoiceState,
    newState: VoiceState,
  ) {
    const userId = newState.id;
    if (newState.member?.user.bot) return;

    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      await this.finishSession(userId, oldState.guild.id, oldState.channelId);
    }

    const channelId = newState.channelId;
    if (!channelId) return;
    const squad = await this.prisma.squad.findFirst({
      where: { voiceChannelId: channelId, guildId: newState.guild.id },
    });
    if (
      !squad ||
      newState.selfMute ||
      newState.serverMute ||
      newState.selfDeaf ||
      newState.serverDeaf
    )
      return;

    await this.prisma.$transaction(async (transaction) => {
      const profile = await transaction.userProfile.upsert({
        where: {
          guildId_discordId: { guildId: newState.guild.id, discordId: userId },
        },
        create: { guildId: newState.guild.id, discordId: userId },
        update: {},
      });
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${newState.guild.id}:${profile.id}`}, 0))`;
      const active = await transaction.voiceSession.findFirst({
        where: { guildId: newState.guild.id, userId: profile.id, active: true },
        select: { id: true },
      });
      if (active) return;
      await transaction.voiceSession.create({
        data: {
          guildId: newState.guild.id,
          userId: profile.id,
          squadId: squad.id,
        },
      });
    });
  }

  private async finishSession(
    discordId: string,
    guildId: string,
    channelId: string,
  ) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { guildId_discordId: { guildId, discordId } },
    });
    if (!profile) return;
    await this.prisma.voiceSession.updateMany({
      where: {
        guildId,
        userId: profile.id,
        active: true,
        squad: { voiceChannelId: channelId, guildId },
      },
      data: { active: false, endedAt: new Date() },
    });
  }

  private async rewardActiveSessions() {
    for (const guild of this.client.guilds.cache.values()) {
      const sessions = await this.prisma.voiceSession.findMany({
        where: { guildId: guild.id, active: true },
        include: { user: true, squad: true },
      });
      for (const session of sessions) {
        if (!session.squad?.voiceChannelId) continue;
        const channel = guild.channels.cache.get(session.squad.voiceChannelId);
        const voiceChannel = channel?.isVoiceBased() ? channel : undefined;
        const member = voiceChannel?.members.get(session.user.discordId);
        if (
          !voiceChannel ||
          !member ||
          voiceChannel.members.size === 0 ||
          member.user.bot ||
          member.voice.selfMute ||
          member.voice.serverMute ||
          member.voice.selfDeaf ||
          member.voice.serverDeaf
        )
          continue;
        const elapsedMinutes = Math.floor(
          (Date.now() - session.startedAt.getTime()) / 60000,
        );
        const minutesToAward = Math.min(
          REWARD_INTERVAL_MINUTES,
          elapsedMinutes - session.minutesAwarded,
        );
        if (minutesToAward <= 0) continue;
        await this.prisma.$transaction(async (transaction) => {
          const claimed = await transaction.voiceSession.updateMany({
            where: {
              id: session.id,
              guildId: session.guildId,
              active: true,
              minutesAwarded: session.minutesAwarded,
            },
            data: { minutesAwarded: { increment: minutesToAward } },
          });
          if (claimed.count !== 1) return;
          await transaction.userProfile.update({
            where: {
              guildId_id: { guildId: session.guildId, id: session.userId },
            },
            data: {
              shogunCoins: { increment: COINS_PER_INTERVAL },
              voiceMinutes: { increment: minutesToAward },
            },
          });
        });
      }
    }
  }
}

export const SHOP_ITEMS = {
  "cosmetic-role": { name: "Cargo cosmético", price: 250, type: "role" },
  "chat-color": { name: "Cor de chat", price: 150, type: "inventory" },
  "squad-slot": { name: "Slot extra de squad", price: 500, type: "inventory" },
  "squad-emoji": {
    name: "Emoji extra de squad",
    price: 350,
    type: "inventory",
  },
} as const;
