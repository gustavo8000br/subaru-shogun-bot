import axios from 'axios';
import { Client, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';

type TwitchStream = { title: string; game_name: string; url: string; thumbnail_url: string };

export class TwitchMonitorService {
  private readonly client: Client;
  private readonly twitchChannel = process.env.TWITCH_CHANNEL_NAME ?? 'subarushogun';
  private readonly clientId = process.env.TWITCH_CLIENT_ID;
  private readonly clientSecret = process.env.TWITCH_CLIENT_SECRET;
  private readonly announceChannelId = process.env.TWITCH_ANNOUNCE_DISCORD_CHANNEL_ID;
  private readonly chatChannelId = process.env.TWITCH_CHAT_DISCORD_CHANNEL_ID;
  private wasLive = false;
  private accessToken?: string;
  private tokenExpiresAt = 0;

  constructor(client: Client) {
    this.client = client;
  }

  async start(): Promise<void> {
    if (!this.clientId || !this.clientSecret || !this.announceChannelId || !this.chatChannelId) {
      console.warn('Monitor Twitch desativado: variáveis Twitch/Discord incompletas.');
      return;
    }
    await this.checkLiveStatus();
    setInterval(() => void this.checkLiveStatus(), 60_000);
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return this.accessToken;
    const response = await axios.post<{ access_token: string; expires_in: number }>(
      'https://id.twitch.tv/oauth2/token', undefined,
      { params: { client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'client_credentials' } },
    );
    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private async checkLiveStatus(): Promise<void> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get<{ data: TwitchStream[] }>('https://api.twitch.tv/helix/streams', {
        headers: { Authorization: `Bearer ${token}`, 'Client-Id': this.clientId },
        params: { user_login: this.twitchChannel },
      });
      const stream = response.data.data[0];
      if (stream && !this.wasLive) await this.announceLive(stream);
      if (!stream && this.wasLive) await this.purgeChatHistory();
      this.wasLive = Boolean(stream);
    } catch (error) {
      console.error('Erro ao consultar status da live na Twitch:', error);
    }
  }

  private async announceLive(stream: TwitchStream): Promise<void> {
    const channel = await this.client.channels.fetch(this.announceChannelId!);
    if (!channel?.isTextBased() || !(channel instanceof TextChannel)) return;
    const me = channel.guild.members.me;
    if (!me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) return;
    const embed = new EmbedBuilder()
      .setColor(0x6441a5)
      .setTitle(`🔴 ${this.twitchChannel} está ao vivo!`)
      .addFields({ name: 'Título', value: stream.title || 'Sem título' }, { name: 'Jogo', value: stream.game_name || 'Não informado' })
      .setURL(stream.url || `https://twitch.tv/${this.twitchChannel}`)
      .setThumbnail(stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180'))
      .setTimestamp();
    await channel.send({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone'] } });
  }

  private async purgeChatHistory(): Promise<void> {
    const channel = await this.client.channels.fetch(this.chatChannelId!);
    if (!channel?.isTextBased() || !(channel instanceof TextChannel)) return;
    const me = channel.guild.members.me;
    if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) {
      console.warn('Sem permissão Manage Messages no canal de chat Twitch.');
      return;
    }
    let deleted = 0;
    let batchSize = 100;
    while (batchSize === 100) {
      const batch = await channel.bulkDelete(100, true);
      batchSize = batch.size;
      deleted += batch.size;
    }
    console.log(`Histórico do chat Twitch limpo: ${deleted} mensagens.`);
  }
}