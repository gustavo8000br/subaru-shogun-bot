import tmi from 'tmi.js';
import { Client, PermissionFlagsBits, TextChannel } from 'discord.js';
import { ResolvedTwitchConfig } from './twitchConfig.js';
import { normalizeExternalText, SlidingWindowRateLimiter } from '../security.js';

export class TwitchChatService {
  private readonly client: Client;
  private readonly connections = new Map<string, tmi.Client>();
  private readonly relayRateLimiter = new SlidingWindowRateLimiter(20, 60_000);

  constructor(client: Client) {
    this.client = client;
  }

  async reconfigure(config: ResolvedTwitchConfig): Promise<void> {
    await this.stop(config.guildId);
    const channel = await this.client.channels.fetch(config.chatChannelId);
    if (!(channel instanceof TextChannel)) throw new Error('Canal de chat Twitch inválido.');
    const me = channel.guild.members.me;
    if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) {
      throw new Error('O bot precisa de Manage Messages no canal de chat Twitch.');
    }

    const connection = new tmi.Client({ channels: [config.channelName] });
    connection.on('message', async (_channel, tags, message, self) => {
      if (self || !message.trim()) return;
      if (!this.relayRateLimiter.allow(config.guildId)) return;
      try {
        const target = await this.client.channels.fetch(config.chatChannelId);
        if (target instanceof TextChannel) {
          const author = normalizeExternalText(tags['display-name'] ?? tags.username ?? 'Usuário', 64);
          const content = normalizeExternalText(message);
          if (!content) return;
          await target.send({ content: `**[Twitch - ${author}]**: ${content}`, allowedMentions: { parse: [] } });
        }
      } catch (error) {
        console.error(`Erro ao espelhar Twitch (${config.guildId}):`, error);
      }
    });
    connection.on('connected', () => console.log(`Chat Twitch conectado: ${config.channelName} (${config.guildId})`));
    await connection.connect();
    this.connections.set(config.guildId, connection);
  }

  async stop(guildId: string): Promise<void> {
    const connection = this.connections.get(guildId);
    if (connection) {
      await connection.disconnect().catch(() => undefined);
      this.connections.delete(guildId);
    }
  }
}
