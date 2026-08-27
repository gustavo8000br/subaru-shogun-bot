import { Client, VoiceState } from 'discord.js';
import { PrismaClient } from '@prisma/client';

const REWARD_INTERVAL_MINUTES = Number(process.env.VOICE_REWARD_INTERVAL_MINUTES ?? 10);
const COINS_PER_INTERVAL = Number(process.env.VOICE_COINS_PER_INTERVAL ?? 10);

export class VoiceEconomyService {
  private timer?: NodeJS.Timeout;

  constructor(private readonly client: Client, private readonly prisma: PrismaClient) {}

  public start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.rewardActiveSessions(), REWARD_INTERVAL_MINUTES * 60 * 1000);
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const userId = newState.id;
    if (newState.member?.user.bot) return;

    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      await this.finishSession(userId, oldState.channelId);
    }

    const channelId = newState.channelId;
    if (!channelId) return;
    const squad = await this.prisma.squad.findFirst({ where: { voiceChannelId: channelId, guildId: newState.guild.id } });
    if (!squad || newState.selfMute || newState.serverMute || newState.selfDeaf || newState.serverDeaf) return;

    const profile = await this.prisma.userProfile.upsert({
      where: { discordId: userId },
      create: { discordId: userId },
      update: {},
    });
    const active = await this.prisma.voiceSession.findFirst({ where: { userId: profile.id, active: true } });
    if (!active) {
      await this.prisma.voiceSession.create({ data: { userId: profile.id, squadId: squad.id } });
    }
  }

  private async finishSession(discordId: string, channelId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { discordId } });
    if (!profile) return;
    await this.prisma.voiceSession.updateMany({
      where: { userId: profile.id, active: true, squad: { voiceChannelId: channelId, guildId: this.client.guilds.cache.find((guild) => guild.channels.cache.has(channelId))?.id } },
      data: { active: false, endedAt: new Date() },
    });
  }

  private async rewardActiveSessions() {
    const sessions = await this.prisma.voiceSession.findMany({
      where: { active: true },
      include: { user: true, squad: true },
    });
    for (const session of sessions) {
      if (!session.squad?.voiceChannelId) continue;
      const channel = this.client.channels.cache.get(session.squad.voiceChannelId);
      const voiceChannel = channel?.isVoiceBased() ? channel : undefined;
      const member = voiceChannel?.members.get(session.user.discordId);
      if (!voiceChannel || !member || voiceChannel.members.size === 0 || member.user.bot || member.voice.selfMute || member.voice.serverMute || member.voice.selfDeaf || member.voice.serverDeaf) continue;
      await this.prisma.$transaction([
        this.prisma.userProfile.update({ where: { id: session.userId }, data: { shogunCoins: { increment: COINS_PER_INTERVAL }, voiceMinutes: { increment: REWARD_INTERVAL_MINUTES } } }),
        this.prisma.voiceSession.update({ where: { id: session.id }, data: { minutesAwarded: { increment: REWARD_INTERVAL_MINUTES } } }),
      ]);
    }
  }
}

export const SHOP_ITEMS = {
  'cosmetic-role': { name: 'Cargo cosmético', price: 250, type: 'role' },
  'chat-color': { name: 'Cor de chat', price: 150, type: 'inventory' },
  'squad-slot': { name: 'Slot extra de squad', price: 500, type: 'inventory' },
  'squad-emoji': { name: 'Emoji extra de squad', price: 350, type: 'inventory' },
} as const;
