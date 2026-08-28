import axios from 'axios';
import { Client, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { ResolvedTwitchConfig } from './twitchConfig.js';
import { normalizeExternalText } from '../security.js';

type TwitchStream = { title: string; game_name: string; thumbnail_url: string };
type MonitorState = { config: ResolvedTwitchConfig; interval: NodeJS.Timeout; wasLive: boolean; token?: string; tokenExpiresAt: number };

export class TwitchMonitorService {
  private readonly client: Client;
  private readonly states = new Map<string, MonitorState>();

  constructor(client: Client) {
    this.client = client;
  }

  async reconfigure(config: ResolvedTwitchConfig): Promise<void> {
    await this.stop(config.guildId);
    const state = { config, interval: setInterval(() => void this.checkLiveStatus(state), 60_000), wasLive: false, tokenExpiresAt: 0 } as MonitorState;
    this.states.set(config.guildId, state);
    await this.checkLiveStatus(state);
  }

  async stop(guildId: string): Promise<void> {
    const state = this.states.get(guildId);
    if (state) clearInterval(state.interval);
    this.states.delete(guildId);
  }

  private async getAccessToken(state: MonitorState): Promise<string> {
    if (state.token && Date.now() < state.tokenExpiresAt) return state.token;
    const response = await axios.post<{ access_token: string; expires_in: number }>('https://id.twitch.tv/oauth2/token', undefined, {
      params: { client_id: state.config.clientId, client_secret: state.config.clientSecret, grant_type: 'client_credentials' },
    });
    state.token = response.data.access_token;
    state.tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
    return state.token;
  }

  private async checkLiveStatus(state: MonitorState): Promise<void> {
    try {
      const token = await this.getAccessToken(state);
      const response = await axios.get<{ data: TwitchStream[] }>('https://api.twitch.tv/helix/streams', {
        headers: { Authorization: `Bearer ${token}`, 'Client-Id': state.config.clientId },
        params: { user_login: state.config.channelName },
      });
      const stream = response.data.data[0];
      if (stream && !state.wasLive) await this.announceLive(state.config, stream);
      if (!stream && state.wasLive) await this.purgeChatHistory(state.config);
      state.wasLive = Boolean(stream);
    } catch (error) {
      console.error(`Erro no monitor Twitch (${state.config.guildId}):`, error);
    }
  }

  private async announceLive(config: ResolvedTwitchConfig, stream: TwitchStream): Promise<void> {
    const channel = await this.client.channels.fetch(config.announceChannelId);
    if (!(channel instanceof TextChannel)) return;
    const me = channel.guild.members.me;
    if (!me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) return;
    const embed = new EmbedBuilder().setColor(0x6441a5).setTitle(`🔴 ${normalizeExternalText(config.channelName, 100)} está ao vivo!`)
      .addFields({ name: 'Título', value: normalizeExternalText(stream.title || 'Sem título', 1_024) }, { name: 'Jogo', value: normalizeExternalText(stream.game_name || 'Não informado', 1_024) })
      .setURL(`https://twitch.tv/${config.channelName}`).setThumbnail(stream.thumbnail_url.replace('{width}', '320').replace('{height}', '180')).setTimestamp();
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  }

  private async purgeChatHistory(config: ResolvedTwitchConfig): Promise<void> {
    const channel = await this.client.channels.fetch(config.chatChannelId);
    if (!(channel instanceof TextChannel)) return;
    const me = channel.guild.members.me;
    if (!me?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) return;
    let deleted = 0;
    let batchSize = 100;
    while (batchSize === 100) {
      const batch = await channel.bulkDelete(100, true);
      batchSize = batch.size;
      deleted += batch.size;
    }
    console.log(`Histórico Twitch limpo em ${config.guildId}: ${deleted} mensagens.`);
  }
}
