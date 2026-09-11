import {
  CommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { resolveTwitchConfig } from "../services/twitchConfig.js";
import { TwitchChatService } from "../services/twitchChat.js";
import { TwitchMonitorService } from "../services/twitchMonitor.js";
import { SHOP_ITEMS } from "../services/voiceEconomy.js";
import { SquadManager } from "../squadManager.js";
import { BOT_VERSION } from "../version.js";
import {
  normalizeExternalText,
  SlidingWindowRateLimiter,
} from "../security.js";

const reportRateLimiter = new SlidingWindowRateLimiter(3, 10 * 60 * 1000);
const PANEL_TTL_MS = 15 * 60 * 1000;

export function buildAdminCommands() {
  return [
    new SlashCommandBuilder()
      .setName("admin")
      .setDescription("Gerenciamento administrativo de squads.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("list-squads")
          .setDescription("Lista todas as squads ativas do servidor."),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set-limit")
          .setDescription("Altera o limite de membros por squad.")
          .addIntegerOption((option) =>
            option
              .setName("limit")
              .setDescription("Novo limite de membros")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(30),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("rename-squad")
          .setDescription("Renomeia uma squad própria.")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Novo nome")
              .setRequired(true)
              .setMaxLength(80),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("end-squad")
          .setDescription("Encerra uma squad ativa por ID ou canal.")
          .addStringOption((option) =>
            option
              .setName("squad-id")
              .setDescription("ID da squad")
              .setRequired(false),
          ),
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Exibe seu saldo de Shogun Coins.")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("versao")
      .setDescription("Exibe a versão atual do bot.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON(),
    new SlashCommandBuilder()
      .setName("shop")
      .setDescription("Exibe a loja de recompensas.")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("buy")
      .setDescription("Resgata um item da loja.")
      .addStringOption((option) =>
        option
          .setName("item_id")
          .setDescription("ID do item")
          .setRequired(true)
          .addChoices(
            ...Object.entries(SHOP_ITEMS).map(([value, item]) => ({
              name: `${item.name} (${item.price})`,
              value,
            })),
          ),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("profile")
      .setDescription("Gerencie seu perfil competitivo.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set-rank")
          .setDescription("Salva seu elo em um jogo.")
          .addStringOption((option) =>
            option.setName("game").setDescription("Jogo").setRequired(true),
          )
          .addStringOption((option) =>
            option.setName("rank").setDescription("Elo").setRequired(true),
          ),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("top")
      .setDescription("Leaderboard semanal do servidor.")
      .addStringOption((option) =>
        option
          .setName("categoria")
          .setDescription("Categoria")
          .setRequired(true)
          .addChoices(
            { name: "Horas de voz", value: "voice" },
            { name: "Shogun Coins", value: "coins" },
            { name: "Reputação", value: "reputation" },
          ),
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("report")
      .setDescription("Denuncia um membro para a staff.")
      .addUserOption((option) =>
        option.setName("user").setDescription("Membro").setRequired(true),
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("Motivo").setRequired(true),
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("twitch")
      .setDescription("Configure a integração Twitch deste servidor.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommandGroup((group) =>
        group
          .setName("config")
          .setDescription("Atualiza as configurações Twitch.")
          .addSubcommand((subcommand) =>
            subcommand
              .setName("credentials")
              .setDescription("Define as credenciais da Twitch.")
              .addStringOption((option) =>
                option
                  .setName("client_id")
                  .setDescription("Client ID da Twitch")
                  .setRequired(true),
              ),
          )
          .addSubcommand((subcommand) =>
            subcommand
              .setName("channel")
              .setDescription("Define o nome do canal Twitch.")
              .addStringOption((option) =>
                option
                  .setName("name")
                  .setDescription("Nome do canal Twitch")
                  .setRequired(true),
              ),
          )
          .addSubcommand((subcommand) =>
            subcommand
              .setName("setup")
              .setDescription("Define os canais Discord da integração.")
              .addChannelOption((option) =>
                option
                  .setName("chat_channel")
                  .setDescription("Canal para espelhar o chat")
                  .addChannelTypes(ChannelType.GuildText)
                  .setRequired(true),
              )
              .addChannelOption((option) =>
                option
                  .setName("announce_channel")
                  .setDescription("Canal para anunciar lives")
                  .addChannelTypes(ChannelType.GuildText)
                  .setRequired(true),
              ),
          ),
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("squad")
      .setDescription("Gerencie a sua squad atual.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("create")
          .setDescription("Cria uma squad a partir do jogo informado.")
          .addStringOption((option) =>
            option.setName("game").setDescription("Jogo").setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("min_rank")
              .setDescription("Elo mínimo")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("max_rank")
              .setDescription("Elo máximo")
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("panel")
          .setDescription("Abre o painel de ações da squad."),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("ban")
          .setDescription("Bane um usuário desta squad.")
          .addUserOption((option) =>
            option.setName("user").setDescription("Usuário").setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("reason")
              .setDescription("Motivo")
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("schedule")
          .setDescription("Agenda uma squad e um evento Discord.")
          .addStringOption((option) =>
            option.setName("game").setDescription("Jogo").setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("time")
              .setDescription("Data ISO, ex: 2026-09-01T20:00:00Z")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option.setName("title").setDescription("Título").setRequired(true),
          )
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Canal do evento")
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildText)
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("min_rank")
              .setDescription("Elo mínimo")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("max_rank")
              .setDescription("Elo máximo")
              .setRequired(false),
          ),
      )
      .toJSON(),
  ];
}

export async function handleTwitchCommand(
  interaction: CommandInteraction,
  prisma: PrismaClient,
  twitchChat: TwitchChatService,
  twitchMonitor: TwitchMonitorService,
) {
  if (
    !interaction.guild ||
    !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    await interaction.reply({
      content: "Apenas administradores podem configurar a Twitch.",
      ephemeral: true,
    });
    return;
  }

  const options = (interaction as any).options;
  const subcommand = options.getSubcommand();
  const data: Record<string, string> = {};
  if (subcommand === "credentials") {
    data.clientId = options.getString("client_id", true);
  } else if (subcommand === "channel") {
    data.channelName = options.getString("name", true).toLowerCase();
  } else if (subcommand === "setup") {
    data.chatChannelId = options.getChannel("chat_channel", true).id;
    data.announceChannelId = options.getChannel("announce_channel", true).id;
  }

  await prisma.twitchConfig.upsert({
    where: { guildId: interaction.guild.id },
    create: { guildId: interaction.guild.id, ...data },
    update: data,
  });
  const config = await resolveTwitchConfig(prisma, interaction.guild.id);
  if (!config) {
    await interaction.reply({
      content:
        "Configuração salva. Complete os demais campos para ativar a integração.",
      ephemeral: true,
    });
    return;
  }

  try {
    await twitchChat.reconfigure(config);
    await twitchMonitor.reconfigure(config);
    await interaction.reply({
      content: "Configuração Twitch salva e serviços reconectados.",
      ephemeral: true,
    });
  } catch (error) {
    console.error("Erro ao reconectar serviços Twitch:", error);
    await interaction.reply({
      content:
        "Configuração salva, mas não foi possível iniciar os serviços. Verifique permissões e credenciais.",
      ephemeral: true,
    });
  }
}

async function getProfile(
  prisma: PrismaClient,
  guildId: string,
  discordId: string,
) {
  return prisma.userProfile.upsert({
    where: { guildId_discordId: { guildId, discordId } },
    create: { guildId, discordId },
    update: {},
  });
}

export async function handleEconomyCommand(
  interaction: CommandInteraction,
  prisma: PrismaClient,
) {
  if (!interaction.guild) {
    await interaction.reply({
      content: "Este comando só pode ser usado em uma guild.",
      ephemeral: true,
    });
    return;
  }
  const guildId = interaction.guild.id;
  const profile = await getProfile(prisma, guildId, interaction.user.id);
  if (interaction.commandName === "balance") {
    await interaction.reply({
      content: `Seu saldo: **${profile.shogunCoins} Shogun Coins**.`,
      ephemeral: true,
    });
    return;
  }
  if (interaction.commandName === "shop") {
    const embed = new EmbedBuilder()
      .setTitle("Loja Shogun")
      .setColor(0xf1c40f)
      .setDescription(
        Object.entries(SHOP_ITEMS)
          .map(([id, item]) => `**${id}** - ${item.name}: ${item.price} coins`)
          .join("\n"),
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
  const itemId = (interaction as any).options.getString(
    "item_id",
    true,
  ) as keyof typeof SHOP_ITEMS;
  const item = SHOP_ITEMS[itemId];
  if (!item) {
    await interaction.reply({ content: "Item inválido.", ephemeral: true });
    return;
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const debit = await transaction.userProfile.updateMany({
        where: { id: profile.id, guildId, shogunCoins: { gte: item.price } },
        data: { shogunCoins: { decrement: item.price } },
      });
      if (debit.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
      await transaction.userInventory.upsert({
        where: {
          guildId_userId_itemId: { guildId, userId: profile.id, itemId },
        },
        create: { guildId, userId: profile.id, itemId },
        update: { quantity: { increment: 1 } },
      });
      await transaction.purchaseLedger.create({
        data: {
          guildId,
          requestId: interaction.id,
          userId: profile.id,
          itemId,
          price: item.price,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_FUNDS") {
      await interaction.reply({
        content: `Saldo insuficiente. Você precisa de ${item.price} coins.`,
        ephemeral: true,
      });
      return;
    }
    const existingPurchase = await prisma.purchaseLedger.findUnique({
      where: {
        guildId_userId_requestId: {
          guildId,
          userId: profile.id,
          requestId: interaction.id,
        },
      },
    });
    if (existingPurchase) {
      await interaction.reply({
        content: "Esta compra já foi processada.",
        ephemeral: true,
      });
      return;
    }
    throw error;
  }
  if (
    item.type === "role" &&
    interaction.guild &&
    interaction.member instanceof GuildMember
  ) {
    const role =
      interaction.guild.roles.cache.get(process.env.COSMETIC_ROLE_ID ?? "") ??
      (await interaction.guild.roles.create({
        name: "Shogun Cosmético",
        color: 0xf1c40f,
        reason: "Recompensa da loja",
      }));
    await interaction.member.roles.add(role).catch(() => undefined);
  }
  await interaction.reply({
    content: `Resgate concluído: **${item.name}**.`,
    ephemeral: true,
  });
}

export async function handleVersionCommand(interaction: CommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "Apenas administradores podem consultar a versão do bot.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `Versão atual do ShogunBot: **${BOT_VERSION}**`,
    ephemeral: true,
  });
}

export async function handleProfileOrTopCommand(
  interaction: CommandInteraction,
  prisma: PrismaClient,
) {
  if (interaction.commandName === "profile") {
    const game = (interaction as any).options
      .getString("game", true)
      .toLowerCase();
    const rank = (interaction as any).options.getString("rank", true);
    if (!interaction.guild) return;
    const profile = await getProfile(
      prisma,
      interaction.guild.id,
      interaction.user.id,
    );
    const ranks = (
      profile.ranks && typeof profile.ranks === "object" ? profile.ranks : {}
    ) as Record<string, string>;
    ranks[game] = rank;
    await prisma.userProfile.update({
      where: { guildId_id: { guildId: interaction.guild.id, id: profile.id } },
      data: { ranks },
    });
    await interaction.reply({
      content: `Elo salvo: **${game} / ${rank}**.`,
      ephemeral: true,
    });
    return;
  }
  const category = (interaction as any).options.getString("categoria", true);
  const orderBy =
    category === "voice"
      ? { voiceMinutes: "desc" as const }
      : category === "coins"
        ? { shogunCoins: "desc" as const }
        : { reputationScore: "desc" as const };
  const label =
    category === "voice"
      ? "Horas de voz"
      : category === "coins"
        ? "Shogun Coins"
        : "Reputação";
  if (!interaction.guild) return;
  const profiles = await prisma.userProfile.findMany({
    where: {
      guildId: interaction.guild.id,
      updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy,
    take: 10,
  });
  const value = (profile: (typeof profiles)[number]) =>
    category === "voice"
      ? `${Math.floor(profile.voiceMinutes / 60)}h ${profile.voiceMinutes % 60}min`
      : category === "coins"
        ? `${profile.shogunCoins} coins`
        : `${profile.reputationScore} pontos (${profile.ggCount} GGs)`;
  const embed = new EmbedBuilder()
    .setTitle(`Top: ${label}`)
    .setColor(0xe67e22)
    .setDescription(
      profiles.length
        ? profiles
            .map(
              (profile, index) =>
                `${index + 1}. <@${profile.discordId}> - ${value(profile)}`,
            )
            .join("\n")
        : "Ainda não há dados.",
    );
  await interaction.reply({ embeds: [embed] });
}

export async function writeAudit(
  prisma: PrismaClient,
  guildId: string,
  actorDiscordId: string,
  eventType: string,
  targetId?: string,
  details: Record<string, string> = {},
) {
  const actor = await prisma.userProfile.upsert({
    where: { guildId_discordId: { guildId, discordId: actorDiscordId } },
    create: { guildId, discordId: actorDiscordId },
    update: {},
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: { guildId, actorId: actor.id, eventType, targetId, details },
  });
}

export async function handleReportCommand(
  interaction: CommandInteraction,
  prisma: PrismaClient,
) {
  if (!interaction.guild) return;
  if (
    !reportRateLimiter.allow(`${interaction.guild.id}:${interaction.user.id}`)
  ) {
    await interaction.reply({
      content: "Limite de denúncias atingido. Tente novamente mais tarde.",
      ephemeral: true,
    });
    return;
  }
  const target = (interaction as any).options.getUser("user", true);
  const reason = normalizeExternalText(
    (interaction as any).options.getString("reason", true),
  );
  if (!reason) {
    await interaction.reply({
      content: "Informe um motivo válido.",
      ephemeral: true,
    });
    return;
  }
  await writeAudit(
    prisma,
    interaction.guild.id,
    interaction.user.id,
    "member_report",
    target.id,
    { reason },
  );
  const channel = interaction.guild.channels.cache.get(
    process.env.STAFF_AUDIT_CHANNEL_ID ?? "",
  );
  if (channel?.isTextBased() && "send" in channel)
    await channel.send({
      content: `Denúncia: <@${interaction.user.id}> denunciou <@${target.id}>. Motivo: ${reason}`,
      allowedMentions: { parse: [] },
    });
  await interaction.reply({
    content: "Denúncia enviada à staff.",
    ephemeral: true,
  });
}

const REPUTATION_LABEL_MAX_LENGTH = 100;

export function getReputationMemberLabel(
  member:
    | { displayName?: string | null; user?: { username?: string | null } }
    | null
    | undefined,
): string {
  const displayName = member?.displayName?.trim();
  const username = member?.user?.username?.trim();
  const label = displayName || username || "Membro da guild";
  return Array.from(label).slice(0, REPUTATION_LABEL_MAX_LENGTH).join("");
}

export function buildReputationMemberOptions(
  guild: any,
  memberIds: string[],
): Array<{ label: string; value: string }> {
  return memberIds.slice(0, 25).map((userId) => ({
    label: getReputationMemberLabel(guild.members.cache.get(userId)),
    value: userId,
  }));
}

export function buildSquadMemberOptions(
  members: Array<{ userId: string }>,
): Array<{ label: string; value: string }> {
  return members.slice(0, 25).map((member) => ({
    label: member.userId,
    value: member.userId,
  }));
}

async function requestSquadReputation(
  guild: any,
  prisma: PrismaClient,
  squadId: string,
  memberIds: string[],
) {
  const options = buildReputationMemberOptions(guild, memberIds);
  if (!options.length) return;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const squad = await prisma.squad.findFirst({
    where: { id: squadId, guildId: guild.id },
    select: { guildId: true },
  });
  if (!squad) return;
  await prisma.reputationParticipant.createMany({
    data: memberIds.map((userId) => ({
      guildId: squad.guildId,
      squadId,
      userId,
      expiresAt,
    })),
    skipDuplicates: true,
  });
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        `reputation-vote:${squad.guildId}:${squadId}:${expiresAt.getTime()}`,
      )
      .setPlaceholder("Escolha um colega para dar GG/Honor")
      .addOptions(options),
  );
  await Promise.all(
    memberIds.map(async (userId) => {
      const member = guild.members.cache.get(userId);
      if (member)
        await member
          .send({
            content: "A squad terminou. Reconheça um colega com GG/Honor:",
            components: [row],
            allowedMentions: { parse: [] },
          })
          .catch(() => undefined);
    }),
  );
}

export async function handleAdminCommand(
  interaction: CommandInteraction,
  prisma: PrismaClient,
) {
  if (!interaction.guild) return;

  const options = (interaction as any).options;
  const subcommand = options.getSubcommand();

  if (subcommand === "list-squads") {
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.reply({
        content: "Você não tem permissão para listar squads.",
        ephemeral: true,
      });
      return;
    }

    const squads = await prisma.squad.findMany({
      where: { guildId: interaction.guild.id, status: "active" },
      include: { members: true, game: true },
      orderBy: { createdAt: "desc" },
    });

    if (squads.length === 0) {
      await interaction.reply({
        content: "Nenhuma squad ativa no momento.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Squads ativas")
      .setColor(0x00ae86)
      .setDescription(
        squads
          .map(
            (squad) =>
              `• ${squad.name} | Jogo: ${squad.game.name} | Membros: ${squad.members.length}`,
          )
          .join("\n"),
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (subcommand === "set-limit") {
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.reply({
        content: "Apenas a staff pode alterar o limite por jogo.",
        ephemeral: true,
      });
      return;
    }

    const limit = (interaction as any).options.getInteger("limit", true);
    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guild.id },
      create: { guildId: interaction.guild.id, maxMembersPerSquad: limit },
      update: { maxMembersPerSquad: limit },
    });

    await interaction.reply({
      content: `Limite de membros por squad atualizado para ${limit}.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "end-squad") {
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.reply({
        content: "Você não pode encerrar squads.",
        ephemeral: true,
      });
      return;
    }

    const squadId = (interaction as any).options.getString("squad-id");
    if (!squadId) {
      await interaction.reply({
        content: "Informe o ID da squad a ser encerrada.",
        ephemeral: true,
      });
      return;
    }

    const squad = await prisma.squad.findFirst({
      where: { id: squadId, guildId: interaction.guild.id },
      include: { members: true },
    });

    if (!squad) {
      await interaction.reply({
        content: "Squad não encontrada.",
        ephemeral: true,
      });
      return;
    }

    const voiceChannel = interaction.guild.channels.cache.get(
      squad.voiceChannelId ?? "",
    );
    const textChannel = interaction.guild.channels.cache.get(
      squad.textChannelId ?? "",
    );
    await requestSquadReputation(
      interaction.guild,
      prisma,
      squad.id,
      squad.members.map((member) => member.userId),
    );

    if (voiceChannel && "delete" in voiceChannel)
      await voiceChannel.delete("Encerramento administrativo da squad.");
    if (textChannel && "delete" in textChannel)
      await textChannel.delete("Encerramento administrativo da squad.");

    await prisma.squadMember.deleteMany({
      where: { guildId: interaction.guild.id, squadId: squad.id },
    });
    await prisma.voiceSession.updateMany({
      where: { guildId: interaction.guild.id, squadId: squad.id, active: true },
      data: { active: false, endedAt: new Date() },
    });
    await prisma.squad.delete({
      where: { guildId_id: { guildId: interaction.guild.id, id: squad.id } },
    });

    await interaction.reply({
      content: `Squad ${squad.name} encerrada com sucesso.`,
      ephemeral: true,
    });
  }

  if (subcommand === "rename-squad") {
    const member = interaction.member as GuildMember;
    const squad = member.voice.channelId
      ? await prisma.squad.findFirst({
          where: {
            guildId: interaction.guild.id,
            voiceChannelId: member.voice.channelId,
            status: "active",
          },
        })
      : null;
    const name = normalizeExternalText(options.getString("name", true), 80);
    if (!squad || squad.ownerId !== interaction.user.id || !name) {
      await interaction.reply({
        content: "Somente o líder pode renomear a própria squad.",
        ephemeral: true,
      });
      return;
    }
    const voiceChannel = interaction.guild.channels.cache.get(
      squad.voiceChannelId ?? "",
    );
    const textChannel = interaction.guild.channels.cache.get(
      squad.textChannelId ?? "",
    );
    await prisma.squad.update({
      where: { guildId_id: { guildId: interaction.guild.id, id: squad.id } },
      data: { name },
    });
    if (voiceChannel?.isVoiceBased())
      await voiceChannel.setName(name, "Renomeação da squad");
    if (textChannel?.isTextBased() && "setName" in textChannel)
      await textChannel.setName(
        `squad-${name
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .slice(0, 90)}`,
        "Renomeação da squad",
      );
    await interaction.reply({
      content: `Squad renomeada para **${name}**.`,
      ephemeral: true,
    });
    return;
  }
}

export async function handleSquadPanel(
  interaction: CommandInteraction,
  prisma: PrismaClient,
  squadManager?: SquadManager,
) {
  const subcommand = (interaction as any).options.getSubcommand();
  if (subcommand === "create") {
    if (!interaction.guild || !squadManager) return;
    const options = (interaction as any).options;
    try {
      const created = await squadManager.createManualSquad(
        interaction.user.id,
        interaction.guild,
        options.getString("game", true),
        options.getString("min_rank") ?? undefined,
        options.getString("max_rank") ?? undefined,
      );
      await interaction.reply({
        content: `Squad criada: <#${created.voiceChannel.id}>.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a squad.",
        ephemeral: true,
      });
    }
    return;
  }
  if (subcommand === "ban") {
    if (!interaction.guild) return;
    const target = (interaction as any).options.getUser("user", true);
    const member = interaction.member as GuildMember;
    const squad = member.voice.channelId
      ? await prisma.squad.findFirst({
          where: {
            voiceChannelId: member.voice.channelId,
            game: { guildId: interaction.guild.id },
          },
          include: { members: true },
        })
      : null;
    if (!squad || squad.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: "Apenas o líder na própria squad pode banir membros.",
        ephemeral: true,
      });
      return;
    }
    const reason = (interaction as any).options.getString("reason") as
      | string
      | null;
    const profile = await getProfile(prisma, interaction.guild.id, target.id);
    await prisma.squadBlacklist.upsert({
      where: {
        guildId_squadId_userId: {
          guildId: interaction.guild.id,
          squadId: squad.id,
          userId: profile.id,
        },
      },
      create: {
        squadId: squad.id,
        userId: profile.id,
        creatorId: (
          await getProfile(prisma, interaction.guild.id, interaction.user.id)
        ).id,
        guildId: interaction.guild.id,
        reason: reason ?? undefined,
      },
      update: { reason: reason ?? undefined },
    });
    const targetMember = interaction.guild.members.cache.get(target.id);
    if (targetMember?.voice.channelId === squad.voiceChannelId)
      await targetMember.voice.disconnect("Ban da squad");
    await writeAudit(
      prisma,
      interaction.guild.id,
      interaction.user.id,
      "squad_ban",
      target.id,
      { squadId: squad.id, reason: reason ?? "" },
    );
    await interaction.reply({
      content: `<@${target.id}> foi banido desta squad.`,
      ephemeral: true,
    });
    return;
  }
  if (subcommand === "schedule") {
    if (!interaction.guild) return;
    const options = (interaction as any).options;
    const scheduledTime = new Date(options.getString("time", true));
    const channel = options.getChannel("channel", true);
    if (Number.isNaN(scheduledTime.getTime()) || scheduledTime <= new Date()) {
      await interaction.reply({
        content: "Informe uma data futura válida em formato ISO.",
        ephemeral: true,
      });
      return;
    }
    const profile = await getProfile(
      prisma,
      interaction.guild.id,
      interaction.user.id,
    );
    const scheduled = await prisma.scheduledSquad.create({
      data: {
        guildId: interaction.guild.id,
        title: options.getString("title", true),
        game: options.getString("game", true),
        scheduledTime,
        creatorId: profile.id,
        minElo: options.getString("min_rank"),
        maxElo: options.getString("max_rank"),
        channelId: channel.id,
      },
    });
    const event = await interaction.guild.scheduledEvents.create({
      name: scheduled.title,
      scheduledStartTime: scheduledTime,
      scheduledEndTime: new Date(scheduledTime.getTime() + 2 * 60 * 60 * 1000),
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.External,
      entityMetadata: { location: channel.name },
      description: `${scheduled.game} | Confirme presença no botão abaixo.`,
    });
    await prisma.scheduledSquad.update({
      where: { id: scheduled.id },
      data: { discordEventId: event.id },
    });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`scheduled-confirm:${scheduled.id}:${Date.now()}`)
        .setLabel("Confirmar Presença")
        .setStyle(ButtonStyle.Success),
    );
    await interaction.reply({
      content: `Evento criado para <t:${Math.floor(scheduledTime.getTime() / 1000)}:F>.`,
      components: [row],
    });
    return;
  }
  if (
    !interaction.guild ||
    !interaction.member ||
    !("voice" in interaction.member)
  ) {
    await interaction.reply({
      content: "Você precisa estar em um canal de voz para usar este painel.",
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const currentVoiceChannel = member.voice.channel;

  if (!currentVoiceChannel) {
    await interaction.reply({
      content: "Você precisa estar em um canal de voz para abrir o painel.",
      ephemeral: true,
    });
    return;
  }

  const squad = await prisma.squad.findFirst({
    where: {
      voiceChannelId: currentVoiceChannel.id,
      game: { guildId: interaction.guild.id },
    },
    include: { members: true },
  });

  if (!squad) {
    await interaction.reply({
      content: "Você não está em uma squad ativa.",
      ephemeral: true,
    });
    return;
  }

  const isOwner = squad.ownerId === member.id;
  const hasStaff =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`squad-lock:${squad.id}:${Date.now()}`)
      .setLabel(squad.lockedAt ? "Desbloquear Sala" : "Bloquear Sala")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`squad-rename:${squad.id}:${Date.now()}`)
      .setLabel("Renomear Squad")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`squad-end:${squad.id}:${Date.now()}`)
      .setLabel("Encerrar Squad")
      .setStyle(ButtonStyle.Danger),
  );

  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`squad-member-actions:${squad.id}:${Date.now()}`)
      .setPlaceholder("Expulsar membro da squad")
      .addOptions(buildSquadMemberOptions(squad.members)),
  );

  const embed = new EmbedBuilder()
    .setTitle(`Painel da Squad: ${squad.name}`)
    .setDescription(
      `Proprietário: <@${squad.ownerId}>\nMembros: ${squad.members.length}`,
    )
    .setColor(0x5865f2);

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    ephemeral: true,
  });
}

export async function handleSquadButtonInteraction(
  interaction: any,
  prisma: PrismaClient,
) {
  const [action, squadId, createdAt] = interaction.customId.split(":");
  if (
    !squadId ||
    !createdAt ||
    Number.isNaN(Number(createdAt)) ||
    (action === "scheduled-confirm"
      ? Date.now() - Number(createdAt) > 7 * 24 * 60 * 60 * 1000
      : Date.now() - Number(createdAt) > PANEL_TTL_MS)
  ) {
    await interaction
      .reply({
        content: "Este painel expirou. Abra um novo painel da squad.",
        ephemeral: true,
      })
      .catch(() => undefined);
    return;
  }

  if (action === "scheduled-confirm") {
    if (!interaction.guild) {
      await interaction.reply({
        content: "Esta ação precisa ser confirmada dentro da guild do evento.",
        ephemeral: true,
      });
      return;
    }
    const profile = await getProfile(
      prisma,
      interaction.guild.id,
      interaction.user.id,
    );
    const scheduled = await prisma.scheduledSquad.findFirst({
      where: { id: squadId, guildId: interaction.guild.id },
    });
    if (!scheduled) return;
    await prisma.scheduledSquadAttendee.upsert({
      where: {
        guildId_scheduledSquadId_userId: {
          guildId: interaction.guild.id,
          scheduledSquadId: squadId,
          userId: profile.id,
        },
      },
      create: {
        guildId: interaction.guild.id,
        scheduledSquadId: squadId,
        userId: profile.id,
      },
      update: {},
    });
    await interaction.reply({
      content: `Presença confirmada para **${scheduled.title}**.`,
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "Esta ação precisa ser executada dentro da guild da squad.",
      ephemeral: true,
    });
    return;
  }
  const squad = await prisma.squad.findFirst({
    where: { id: squadId, guildId: guild.id },
    include: { members: true },
  });
  if (!squad) return;
  if (squad.status !== "active") {
    await interaction.reply({
      content: "Esta squad não está disponível neste servidor.",
      ephemeral: true,
    });
    return;
  }
  const isStaff =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
  const isOwner = squad.ownerId === interaction.user.id;
  const isCurrentMember = squad.members.some(
    (member) => member.userId === interaction.user.id,
  );
  if ((!isOwner && !isStaff) || (!isCurrentMember && !isStaff)) {
    await interaction.reply({
      content: "Você não tem autorização para esta ação.",
      ephemeral: true,
    });
    return;
  }
  const voiceChannel = squad.voiceChannelId
    ? guild.channels.cache.get(squad.voiceChannelId)
    : undefined;
  const textChannel = squad.textChannelId
    ? guild.channels.cache.get(squad.textChannelId)
    : undefined;
  if (
    voiceChannel?.guild?.id !== guild.id ||
    textChannel?.guild?.id !== guild.id
  ) {
    await interaction.reply({
      content: "A squad não pertence a este servidor.",
      ephemeral: true,
    });
    return;
  }

  if (action === "squad-end") {
    await requestSquadReputation(
      guild,
      prisma,
      squad.id,
      squad.members.map((member) => member.userId),
    );

    if (voiceChannel && "delete" in voiceChannel)
      await voiceChannel.delete("Squad encerrada pelo painel.");
    if (textChannel && "delete" in textChannel)
      await textChannel.delete("Squad encerrada pelo painel.");

    await prisma.squadMember.deleteMany({
      where: { guildId: guild.id, squadId: squad.id },
    });
    await prisma.voiceSession.updateMany({
      where: { guildId: guild.id, squadId: squad.id, active: true },
      data: { active: false, endedAt: new Date() },
    });
    await prisma.squad.delete({
      where: { guildId_id: { guildId: guild.id, id: squad.id } },
    });

    await interaction.reply({
      content: "Squad encerrada com sucesso.",
      ephemeral: true,
    });
    return;
  }

  if (action === "squad-lock") {
    const channel = guild.channels.cache.get(squad.voiceChannelId ?? "");
    if (!channel || channel.type !== 2) return;

    const isLocked = channel.permissionOverwrites.cache.some(
      (overwrite: any) =>
        overwrite.id === guild.roles.everyone.id &&
        overwrite.deny.has("Connect"),
    );
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      Connect: isLocked ? null : false,
    });
    await interaction.reply({
      content: isLocked ? "Sala desbloqueada." : "Sala bloqueada.",
      ephemeral: true,
    });
    return;
  }

  if (action === "squad-rename") {
    await interaction.reply({
      content: "Funcionalidade de renomear squad em desenvolvimento.",
      ephemeral: true,
    });
  }
}

export async function handleMemberSelection(
  interaction: any,
  prisma: PrismaClient,
) {
  const [action, ...componentParts] = interaction.customId.split(":");
  const isReputation = action === "reputation-vote";
  const componentGuildId = isReputation ? componentParts[0] : undefined;
  const squadId = isReputation ? componentParts[1] : componentParts[0];
  const expiresAt = isReputation ? componentParts[2] : componentParts[1];
  if (action === "reputation-vote") {
    const squad = await prisma.squad.findUnique({
      where: {
        guildId_id: { guildId: componentGuildId!, id: squadId! },
      },
      select: { guildId: true },
    });
    if (!squad) {
      await interaction.reply({
        content: "Esta sessão não pertence a este servidor.",
        ephemeral: true,
      });
      return;
    }
    const targetId = interaction.values?.[0];
    if (
      !squadId ||
      !expiresAt ||
      Number.isNaN(Number(expiresAt)) ||
      Date.now() > Number(expiresAt) ||
      !targetId ||
      targetId === interaction.user.id
    ) {
      await interaction.reply({
        content: "Escolha outro membro.",
        ephemeral: true,
      });
      return;
    }
    const [voter, target] = await Promise.all([
      prisma.reputationParticipant.findFirst({
        where: {
          squadId,
          guildId: componentGuildId!,
          userId: interaction.user.id,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.reputationParticipant.findFirst({
        where: {
          guildId: componentGuildId!,
          squadId,
          userId: targetId,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);
    if (!voter || !target) {
      await interaction.reply({
        content: "Você só pode reconhecer participantes da sessão válida.",
        ephemeral: true,
      });
      return;
    }
    const targetProfile = await getProfile(prisma, componentGuildId!, targetId);
    try {
      await prisma.$transaction(async (transaction) => {
        await transaction.reputationVote.create({
          data: {
            guildId: squad.guildId,
            squadId,
            voterId: interaction.user.id,
            targetId,
            type: "gg",
          },
        });
        await transaction.userProfile.update({
          where: {
            guildId_id: { guildId: componentGuildId!, id: targetProfile.id },
          },
          data: {
            reputationScore: { increment: 1 },
            ggCount: { increment: 1 },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        await interaction.reply({
          content: "Você já reconheceu este membro nesta sessão.",
          ephemeral: true,
        });
        return;
      }
      throw error;
    }
    await interaction.reply({
      content: `GG/Honor enviado para <@${targetId}>.`,
      ephemeral: true,
    });
    return;
  }
  if (action !== "squad-member-actions" || !squadId) return;

  const values = interaction.values ?? [];
  const memberId = values[0];

  const guild = interaction.guild;
  const squad = await prisma.squad.findFirst({
    where: { id: squadId, guildId: guild?.id, status: "active" },
  });
  if (
    !guild ||
    !squad ||
    !expiresAt ||
    Number.isNaN(Number(expiresAt)) ||
    Date.now() - Number(expiresAt) > PANEL_TTL_MS
  ) {
    await interaction
      .reply({
        content: "Este painel expirou ou não está disponível neste servidor.",
        ephemeral: true,
      })
      .catch(() => undefined);
    return;
  }

  const member = guild.members.cache.get(memberId);
  const isStaff =
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
  const targetEntry = await prisma.squadMember.findUnique({
    where: {
      guildId_squadId_userId: { guildId: guild.id, squadId, userId: memberId },
    },
  });
  const isAuthorized = squad.ownerId === interaction.user.id || isStaff;
  const squadChannel = guild.channels.cache.get(squad.voiceChannelId ?? "");
  if (!isAuthorized || !targetEntry || squadChannel?.guild?.id !== guild.id) {
    await interaction.reply({
      content: "Você não tem autorização ou o alvo não pertence mais à squad.",
      ephemeral: true,
    });
    return;
  }
  if (member) {
    await member.voice.disconnect();
  }

  const textChannel = guild.channels.cache.get(squad.textChannelId ?? "");
  if (squadChannel && "permissionOverwrites" in squadChannel) {
    await squadChannel.permissionOverwrites
      .delete(memberId)
      .catch(() => undefined);
  }
  if (textChannel && "permissionOverwrites" in textChannel) {
    await textChannel.permissionOverwrites
      .delete(memberId)
      .catch(() => undefined);
  }

  await prisma.squadMember.deleteMany({
    where: { guildId: guild.id, squadId, userId: memberId },
  });
  await interaction.reply({
    content: `Membro ${memberId} removido da squad.`,
    ephemeral: true,
  });
}
