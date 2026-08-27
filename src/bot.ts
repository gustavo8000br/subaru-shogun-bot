import { Client, Events, GatewayIntentBits, Interaction, REST, Routes, SlashCommandBuilder, Collection, ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { buildAdminCommands, handleAdminCommand, handleSquadButtonInteraction, handleMemberSelection, handleSquadPanel } from './commands/adminCommands.js';
import { SquadManager } from './squadManager.js';
import { TwitchChatService } from './services/twitchChat.js';
import { TwitchMonitorService } from './services/twitchMonitor.js';

export class SubaruShogunBot {
  private client: Client;
  private prisma: PrismaClient;
  private squadManager: SquadManager;
  private twitchChat: TwitchChatService;
  private twitchMonitor: TwitchMonitorService;

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

    this.setupEvents();
  }

  private setupEvents() {
    this.client.once(Events.ClientReady, async () => {
      console.log(`Bot online: ${this.client.user?.tag}`);
      await this.squadManager.start();
      await this.registerCommands();
      await this.twitchChat.start();
      await this.twitchMonitor.start();
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isCommand()) {
        if (interaction.commandName === 'admin') {
          await handleAdminCommand(interaction, this.prisma);
          return;
        }

        if (interaction.commandName === 'squad') {
          await handleSquadPanel(interaction, this.prisma);
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
