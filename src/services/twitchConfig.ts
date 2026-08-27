import { PrismaClient, TwitchConfig } from '@prisma/client';

export type ResolvedTwitchConfig = TwitchConfig & {
  clientId: string;
  clientSecret: string;
  channelName: string;
  chatChannelId: string;
  announceChannelId: string;
};

export async function resolveTwitchConfig(prisma: PrismaClient, guildId: string): Promise<ResolvedTwitchConfig | null> {
  const stored = await prisma.twitchConfig.findUnique({ where: { guildId } });
  const values = {
    clientId: stored?.clientId ?? process.env.TWITCH_CLIENT_ID,
    clientSecret: stored?.clientSecret ?? process.env.TWITCH_CLIENT_SECRET,
    channelName: stored?.channelName ?? process.env.TWITCH_CHANNEL_NAME,
    chatChannelId: stored?.chatChannelId ?? process.env.TWITCH_CHAT_DISCORD_CHANNEL_ID,
    announceChannelId: stored?.announceChannelId ?? process.env.TWITCH_ANNOUNCE_DISCORD_CHANNEL_ID,
  };

  if (!values.clientId || !values.clientSecret || !values.channelName || !values.chatChannelId || !values.announceChannelId) return null;
  return { ...(stored ?? { id: '', guildId, createdAt: new Date(), updatedAt: new Date() }), ...values } as ResolvedTwitchConfig;
}