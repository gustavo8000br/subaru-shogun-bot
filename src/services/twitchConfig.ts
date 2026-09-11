import { PrismaClient, TwitchConfig } from "@prisma/client";

export type ResolvedTwitchConfig = TwitchConfig & {
  clientId: string;
  clientSecret: string;
  channelName: string;
  chatChannelId: string;
  announceChannelId: string;
};

export async function resolveTwitchConfig(
  prisma: PrismaClient,
  guildId: string,
): Promise<ResolvedTwitchConfig | null> {
  const stored = await prisma.twitchConfig.findUnique({ where: { guildId } });
  if (!stored) return null;

  const values = {
    clientId: stored.clientId,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    channelName: stored.channelName,
    chatChannelId: stored.chatChannelId,
    announceChannelId: stored.announceChannelId,
  };

  if (
    !values.clientId ||
    !values.clientSecret ||
    !values.channelName ||
    !values.chatChannelId ||
    !values.announceChannelId
  )
    return null;
  return { ...stored, ...values } as ResolvedTwitchConfig;
}
