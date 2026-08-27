import { Client, Events, GatewayIntentBits, Interaction, REST, Routes, SlashCommandBuilder, Collection, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { buildAdminCommands, handleAdminCommand, handleSquadButtonInteraction, handleMemberSelection, handleSquadPanel, handleTwitchCommand, handleEconomyCommand, handleProfileOrTopCommand, handleReportCommand, handleVersionCommand } from './commands/adminCommands.js';
import { SquadManager } from './squadManager.js';
import { TwitchChatService } from './services/twitchChat.js';
import { TwitchMonitorService } from './services/twitchMonitor.js';
import { resolveTwitchConfig } from './services/twitchConfig.js';
import { VoiceEconomyService } from './services/voiceEconomy.js';

export class SubaruShogunBot {
  private client: Client;
  private prisma: PrismaClient;
  private squadManager: SquadManager;
  private twitchChat: TwitchChatService;
  private twitchMonitor: TwitchMonitorService;
  private voiceEconomy: VoiceEconomyService;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.prisma = new PrismaClient();
    this.squadManager = new SquadManager(this.client, this.prisma);
    this.twitchChat = new TwitchChatService(this.client);
    this.twitchMonitor = new TwitchMonitorService(this.client);
    this.voiceEconomy = new VoiceEconomyService(this.client, this.prisma);

    this.setupEvents();
  }

  private setupEvents() {
    this.client.once(Events.ClientReady, async () => {
      console.log(`Bot online: ${this.client.user?.tag}`);
      await this.squadManager.start();
      this.voiceEconomy.start();
      setInterval(() => void this.notifyScheduledSquads(), 60 * 1000);
      await this.registerCommands();
      for (const guild of this.client.guilds.cache.values()) {
        const config = await resolveTwitchConfig(this.prisma, guild.id);
        if (config) {
          await this.twitchChat.reconfigure(config);
          await this.twitchMonitor.reconfigure(config);
        }
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isCommand()) {
        if (['balance', 'shop', 'buy'].includes(interaction.commandName)) {
          await handleEconomyCommand(interaction, this.prisma);
          return;
        }
        if (interaction.commandName === 'versao') {
          await handleVersionCommand(interaction);
          return;
        }
        if (['profile', 'top'].includes(interaction.commandName)) {
          await handleProfileOrTopCommand(interaction, this.prisma);
          return;
        }
        if (interaction.commandName === 'report') {
          await handleReportCommand(interaction, this.prisma);
          return;
        }
        if (interaction.commandName === 'admin') {
          await handleAdminCommand(interaction, this.prisma);
          return;
        }

        if (interaction.commandName === 'squad') {
          await handleSquadPanel(interaction, this.prisma, this.squadManager);
          return;
        }

        if (interaction.commandName === 'twitch') {
          await handleTwitchCommand(interaction, this.prisma, this.twitchChat, this.twitchMonitor);
          return;
        }
      }

      if (interaction.isButton()) {
        await handleSquadButtonInteraction(interaction, this.prisma);
      }

      if (interaction.isStringSelectMenu()) {
        await handleMemberSelection(interaction, this.prisma);
      }
    });

    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      try {
        await this.squadManager.handleVoiceStateUpdate(oldState, newState);
        await this.voiceEconomy.handleVoiceStateUpdate(oldState, newState);
      } catch (error) {
        console.error('Erro ao processar alteração de voz:', error);
      }
    });

    this.client.on(Events.MessageCreate, async (message) => {
      try {
        await this.squadManager.handleMessageCreate(message);
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
      }
    });
  }

  private async notifyScheduledSquads() {
    const now = Date.now();
    const upcoming = await this.prisma.scheduledSquad.findMany({ where: { status: 'scheduled', scheduledTime: { lte: new Date(now + 15 * 60 * 1000), gte: new Date(now) } }, include: { attendees: true } });
    for (const scheduled of upcoming) {
      const channel = scheduled.channelId ? this.client.channels.cache.get(scheduled.channelId) : undefined;
      if (channel?.isTextBased() && 'send' in channel) await channel.send(`Lembrete: **${scheduled.title}** começa em 15 minutos. ${scheduled.attendees.map(attendee => `<@${attendee.userId}>`).join(' ')}`);
      await this.prisma.scheduledSquad.update({ where: { id: scheduled.id }, data: { status: 'notified' } });
    }
  }

  private async registerCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!token || !clientId || !guildId) {
      throw new Error('DISCORD_TOKEN, CLIENT_ID e GUILD_ID devem estar definidos.');
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const commands = buildAdminCommands();

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log('Comandos registrados com sucesso.');
  }

  public async login() {
    await this.client.login(process.env.DISCORD_TOKEN);
  }
}
