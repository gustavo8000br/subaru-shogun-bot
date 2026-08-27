import { CommandInteraction, GuildMember, PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuInteraction, ChannelType } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { resolveTwitchConfig } from '../services/twitchConfig.js';
import { TwitchChatService } from '../services/twitchChat.js';
import { TwitchMonitorService } from '../services/twitchMonitor.js';

export function buildAdminCommands() {
  return [
    new SlashCommandBuilder()
      .setName('admin')
      .setDescription('Gerenciamento administrativo de squads.')
      .addSubcommand(subcommand =>
        subcommand
          .setName('list-squads')
          .setDescription('Lista todas as squads ativas do servidor.')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('set-limit')
          .setDescription('Altera o limite de membros por squad.')
          .addIntegerOption(option =>
            option.setName('limit').setDescription('Novo limite de membros').setRequired(true).setMinValue(1).setMaxValue(30)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('end-squad')
          .setDescription('Encerra uma squad ativa por ID ou canal.')
          .addStringOption(option =>
            option.setName('squad-id').setDescription('ID da squad').setRequired(false)
          )
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName('twitch')
      .setDescription('Configure a integração Twitch deste servidor.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommandGroup(group => group
        .setName('config')
        .setDescription('Atualiza as configurações Twitch.')
        .addSubcommand(subcommand => subcommand
          .setName('credentials')
          .setDescription('Define as credenciais da Twitch.')
          .addStringOption(option => option.setName('client_id').setDescription('Client ID da Twitch').setRequired(true))
          .addStringOption(option => option.setName('client_secret').setDescription('Client Secret da Twitch').setRequired(true)))
        .addSubcommand(subcommand => subcommand
          .setName('channel')
          .setDescription('Define o nome do canal Twitch.')
          .addStringOption(option => option.setName('name').setDescription('Nome do canal Twitch').setRequired(true)))
        .addSubcommand(subcommand => subcommand
          .setName('setup')
          .setDescription('Define os canais Discord da integração.')
          .addChannelOption(option => option.setName('chat_channel').setDescription('Canal para espelhar o chat').addChannelTypes(ChannelType.GuildText).setRequired(true))
          .addChannelOption(option => option.setName('announce_channel').setDescription('Canal para anunciar lives').addChannelTypes(ChannelType.GuildText).setRequired(true))))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('squad')
      .setDescription('Gerencie a sua squad atual.')
      .addSubcommand(subcommand =>
        subcommand
          .setName('panel')
          .setDescription('Abre o painel de ações da squad.')
      )
      .toJSON(),
  ];
}

export async function handleTwitchCommand(interaction: CommandInteraction, prisma: PrismaClient, twitchChat: TwitchChatService, twitchMonitor: TwitchMonitorService) {
  if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Apenas administradores podem configurar a Twitch.', ephemeral: true });
    return;
  }

  const options = (interaction as any).options;
  const subcommand = options.getSubcommand();
  const data: Record<string, string> = {};
  if (subcommand === 'credentials') {
    data.clientId = options.getString('client_id', true);
    data.clientSecret = options.getString('client_secret', true);
  } else if (subcommand === 'channel') {
    data.channelName = options.getString('name', true).toLowerCase();
  } else if (subcommand === 'setup') {
    data.chatChannelId = options.getChannel('chat_channel', true).id;
    data.announceChannelId = options.getChannel('announce_channel', true).id;
  }

  await prisma.twitchConfig.upsert({
    where: { guildId: interaction.guild.id },
    create: { guildId: interaction.guild.id, ...data },
    update: data,
  });
  const config = await resolveTwitchConfig(prisma, interaction.guild.id);
  if (!config) {
    await interaction.reply({ content: 'Configuração salva. Complete os demais campos para ativar a integração.', ephemeral: true });
    return;
  }

  try {
    await twitchChat.reconfigure(config);
    await twitchMonitor.reconfigure(config);
    await interaction.reply({ content: 'Configuração Twitch salva e serviços reconectados.', ephemeral: true });
  } catch (error) {
    console.error('Erro ao reconectar serviços Twitch:', error);
    await interaction.reply({ content: 'Configuração salva, mas não foi possível iniciar os serviços. Verifique permissões e credenciais.', ephemeral: true });
  }
}

export async function handleAdminCommand(interaction: CommandInteraction, prisma: PrismaClient) {
  if (!interaction.guild) return;

  const options = (interaction as any).options;
  const subcommand = options.getSubcommand();

  if (subcommand === 'list-squads') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: 'Você não tem permissão para listar squads.', ephemeral: true });
      return;
    }

    const squads = await prisma.squad.findMany({
      include: { members: true, game: true },
      orderBy: { createdAt: 'desc' },
    });

    if (squads.length === 0) {
      await interaction.reply({ content: 'Nenhuma squad ativa no momento.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Squads ativas')
      .setColor(0x00ae86)
      .setDescription(squads.map((squad) => `• ${squad.name} | Jogo: ${squad.game.name} | Membros: ${squad.members.length}`).join('\n'));

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (subcommand === 'set-limit') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Apenas a staff pode alterar o limite por jogo.', ephemeral: true });
      return;
    }

    const limit = (interaction as any).options.getInteger('limit', true);
    process.env.MAX_MEMBERS_PER_SQUAD = String(limit);

    await interaction.reply({ content: `Limite de membros por squad atualizado para ${limit}.`, ephemeral: true });
    return;
  }

  if (subcommand === 'end-squad') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: 'Você não pode encerrar squads.', ephemeral: true });
      return;
    }

    const squadId = (interaction as any).options.getString('squad-id');
    if (!squadId) {
      await interaction.reply({ content: 'Informe o ID da squad a ser encerrada.', ephemeral: true });
      return;
    }

    const squad = await prisma.squad.findUnique({
      where: { id: squadId },
      include: { members: true },
    });

    if (!squad) {
      await interaction.reply({ content: 'Squad não encontrada.', ephemeral: true });
      return;
    }

    const voiceChannel = interaction.guild.channels.cache.get(squad.voiceChannelId ?? '');
    const textChannel = interaction.guild.channels.cache.get(squad.textChannelId ?? '');

    if (voiceChannel && 'delete' in voiceChannel) await voiceChannel.delete('Encerramento administrativo da squad.');
    if (textChannel && 'delete' in textChannel) await textChannel.delete('Encerramento administrativo da squad.');

    await prisma.squadMember.deleteMany({ where: { squadId: squad.id } });
    await prisma.squad.delete({ where: { id: squad.id } });

    await interaction.reply({ content: `Squad ${squad.name} encerrada com sucesso.`, ephemeral: true });
  }
}

export async function handleSquadPanel(interaction: CommandInteraction, prisma: PrismaClient) {
  if (!interaction.guild || !interaction.member || !('voice' in interaction.member)) {
    await interaction.reply({ content: 'Você precisa estar em um canal de voz para usar este painel.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  const currentVoiceChannel = member.voice.channel;

  if (!currentVoiceChannel) {
    await interaction.reply({ content: 'Você precisa estar em um canal de voz para abrir o painel.', ephemeral: true });
    return;
  }

  const squad = await prisma.squad.findFirst({
    where: { voiceChannelId: currentVoiceChannel.id },
    include: { members: true },
  });

  if (!squad) {
    await interaction.reply({ content: 'Você não está em uma squad ativa.', ephemeral: true });
    return;
  }

  const isOwner = squad.ownerId === member.id;
  const hasStaff = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`squad-lock:${squad.id}`).setLabel(squad.voiceChannelId ? 'Bloquear Sala' : 'Desbloquear Sala').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`squad-rename:${squad.id}`).setLabel('Renomear Squad').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`squad-end:${squad.id}`).setLabel('Encerrar Squad').setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`squad-member-actions:${squad.id}`)
      .setPlaceholder('Expulsar membro da squad')
      .addOptions(
        squad.members.map((memberRecord) => ({
          label: memberRecord.userId,
          value: memberRecord.userId,
        }))
      )
  );

  const embed = new EmbedBuilder()
    .setTitle(`Painel da Squad: ${squad.name}`)
    .setDescription(`Proprietário: <@${squad.ownerId}>\nMembros: ${squad.members.length}`)
    .setColor(0x5865f2);

  await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
}

export async function handleSquadButtonInteraction(interaction: any, prisma: PrismaClient) {
  const [action, squadId] = interaction.customId.split(':');
  if (!squadId) return;

  const squad = await prisma.squad.findUnique({ where: { id: squadId }, include: { members: true } });
  if (!squad) return;

  if (action === 'squad-end') {
    const guild = interaction.guild;
    if (!guild) return;

    const voiceChannel = guild.channels.cache.get(squad.voiceChannelId ?? '');
    const textChannel = guild.channels.cache.get(squad.textChannelId ?? '');

    if (voiceChannel && 'delete' in voiceChannel) await voiceChannel.delete('Squad encerrada pelo painel.');
    if (textChannel && 'delete' in textChannel) await textChannel.delete('Squad encerrada pelo painel.');

    await prisma.squadMember.deleteMany({ where: { squadId: squad.id } });
    await prisma.squad.delete({ where: { id: squad.id } });

    await interaction.reply({ content: 'Squad encerrada com sucesso.', ephemeral: true });
    return;
  }

  if (action === 'squad-lock') {
    const guild = interaction.guild;
    if (!guild) return;
    const channel = guild.channels.cache.get(squad.voiceChannelId ?? '');
    if (!channel || channel.type !== 2) return;

    const isLocked = channel.permissionOverwrites.cache.some((overwrite: any) => overwrite.id === guild.roles.everyone.id && overwrite.deny.has('Connect'));
    await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: isLocked ? null : false });
    await interaction.reply({ content: isLocked ? 'Sala desbloqueada.' : 'Sala bloqueada.', ephemeral: true });
    return;
  }

  if (action === 'squad-rename') {
    await interaction.reply({ content: 'Funcionalidade de renomear squad em desenvolvimento.', ephemeral: true });
  }
}

export async function handleMemberSelection(interaction: any, prisma: PrismaClient) {
  const [action, squadId] = interaction.customId.split(':');
  if (action !== 'squad-member-actions' || !squadId) return;

  const values = interaction.values ?? [];
  const memberId = values[0];

  const guild = interaction.guild;
  const squad = await prisma.squad.findUnique({ where: { id: squadId } });
  if (!guild || !squad) return;

  const member = guild.members.cache.get(memberId);
  if (member) {
    await member.voice.disconnect();
  }

  await prisma.squadMember.deleteMany({ where: { squadId, userId: memberId } });
  await interaction.reply({ content: `Membro ${memberId} removido da squad.`, ephemeral: true });
}
