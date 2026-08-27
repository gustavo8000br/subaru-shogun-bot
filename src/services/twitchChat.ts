import tmi from 'tmi.js';
import { Client, PermissionFlagsBits, TextChannel } from 'discord.js';

export class TwitchChatService {
  private readonly twitchChannel = process.env.TWITCH_CHANNEL_NAME ?? 'subarushogun';
  private readonly discordChannelId = process.env.TWITCH_CHAT_DISCORD_CHANNEL_ID;
  private readonly client: Client;
  private twitchClient?: tmi.Client;

  constructor(client: Client) {
    this.client = client;
  }

  async start(): Promise<void> {
    if (!this.discordChannelId) {
      console.warn('Twitch chat desativado: TWITCH_CHAT_DISCORD_CHANNEL_ID não definido.');
      return;
    }
    const discordChannelId = this.discordChannelId;
    const discordChannel = await this.client.channels.fetch(discordChannelId);
    if (!discordChannel || !(discordChannel instanceof TextChannel)) {
      console.warn('Twitch chat desativado: canal Discord inválido.');
      return;
    }
    const me = discordChannel.guild.members.me;
    if (!me?.permissionsIn(discordChannel).has(PermissionFlagsBits.ManageMessages)) {
      console.warn('Twitch chat desativado: o bot precisa de Manage Messages no canal de chat.');
      return;
    }

    this.twitchClient = new tmi.Client({ channels: [this.twitchChannel] });
    this.twitchClient.on('message', async (_channel, tags, message, self) => {
      if (self || !message.trim()) return;

      try {
        const discordChannel = await this.client.channels.fetch(discordChannelId);
        if (!discordChannel?.isTextBased() || !(discordChannel instanceof TextChannel)) return;
        await discordChannel.send(`**[Twitch - ${tags['display-name'] ?? tags.username ?? 'Usuário'}]**: ${message}`);
      } catch (error) {
        console.error('Erro ao espelhar mensagem da Twitch:', error);
      }
    });

    this.twitchClient.on('connected', () => console.log(`Chat da Twitch conectado: ${this.twitchChannel}`));
    this.twitchClient.on('disconnected', (reason) => console.warn(`Chat da Twitch desconectado: ${reason}`));
    await this.twitchClient.connect();
  }
}