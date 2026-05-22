import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type MessageEditOptions,
  type GuildTextBasedChannel,
  type Role
} from "discord.js";
import type { Language } from "@tiles-survive/database";
import { prisma } from "../db.js";
import { languageChoices } from "./options.js";
import type { BotCommand } from "./types.js";
import { languageEmoji, languageName, parseLanguageCsv, type SupportedLanguage } from "../constants/languages.js";
import { logToAdmin } from "../services/adminLog.js";

export const rolesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Manage language reaction roles")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a reaction role channel and message")
        .addStringOption((option) => option.setName("languages").setDescription("Comma-separated languages, e.g. english,russian,turkish").setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("assign")
        .setDescription("Assign or update a role for a reaction role language")
        .addStringOption((option) => option.setName("message-id").setDescription("Reaction role message ID").setRequired(true))
        .addStringOption((option) => option.setName("language").setDescription("Language").addChoices(...languageChoices).setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("Role to assign").setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add-language")
        .setDescription("Add a language to a reaction role message")
        .addStringOption((option) => option.setName("message-id").setDescription("Reaction role message ID").setRequired(true))
        .addStringOption((option) => option.setName("language").setDescription("Language").addChoices(...languageChoices).setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove-language")
        .setDescription("Remove a language from a reaction role message")
        .addStringOption((option) => option.setName("message-id").setDescription("Reaction role message ID").setRequired(true))
        .addStringOption((option) => option.setName("language").setDescription("Language").addChoices(...languageChoices).setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a reaction role message and its channel")
        .addStringOption((option) => option.setName("message-id").setDescription("Reaction role message ID").setRequired(true))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "create") return createReactionRoles(interaction);
    if (subcommand === "assign") return assignRole(interaction);
    if (subcommand === "add-language") return addLanguage(interaction);
    if (subcommand === "remove-language") return removeLanguage(interaction);
    if (subcommand === "delete") return deleteReactionRoles(interaction);
  }
};

export function pendingRoleMessage(languages: SupportedLanguage[]): string {
  const lines: Record<SupportedLanguage, string> = {
    en: "An administrator still needs to assign language roles.",
    ru: "Администратор еще должен назначить языковые роли.",
    tr: "Bir yöneticinin dil rollerini ataması gerekiyor."
  };
  return languages.map((language) => `${languageEmoji(language)} ${lines[language]}`).join("\n");
}

export function readyRoleMessage(languages: SupportedLanguage[]): string {
  const lines: Record<SupportedLanguage, string> = {
    en: "React with the emoji of your language to receive your role. You may react to multiple.",
    ru: "Нажмите на эмодзи своего языка, чтобы получить роль. Можно выбрать несколько.",
    tr: "Rolünüzü almak için dilinizin emojisine tıklayın. Birden fazla seçebilirsiniz."
  };
  const mapping = languages.map((language) => `${languageEmoji(language)} ${languageName(language)}`).join("\n");
  return `${languages.map((language) => `${languageEmoji(language)} ${lines[language]}`).join("\n")}\n\n${mapping}`;
}

export function readyRoleEmbed(languages: SupportedLanguage[]): EmbedBuilder {
  const lines: Record<SupportedLanguage, string> = {
    en: "React with the emoji of your language to receive your role. You may react to multiple.",
    ru: "Нажмите на флаг своего языка, чтобы получить роль. Можно выбрать несколько языков.",
    tr: "Dil rolünüzü almak için Türk bayrağına tıklayın. Birden fazla seçim yapabilirsiniz."
  };

  return new EmbedBuilder()
    .setTitle("Language Roles")
    .setColor(0x2f80ed)
    .setDescription(languages.map((language) => `${languageEmoji(language)} ${lines[language]}`).join("\n\n"))
    .addFields({
      name: "Available languages",
      value: languages.map((language) => `${languageEmoji(language)} ${languageName(language)}`).join("\n")
    });
}

export function reactionRoleMessagePayload(languages: SupportedLanguage[], complete: boolean): MessageEditOptions {
  if (complete) {
    return {
      content: null,
      embeds: [readyRoleEmbed(languages)]
    };
  }

  return {
    content: pendingRoleMessage(languages),
    embeds: []
  };
}

async function createReactionRoles(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const languages = parseLanguageCsv(interaction.options.getString("languages", true));
  if (languages.length === 0) {
    await interaction.reply({ content: "Provide at least one supported language: english, russian, turkish.", ephemeral: true });
    return;
  }

  const channel = await guild.channels.create({
    name: "language-roles",
    type: ChannelType.GuildText,
    reason: "Language reaction role setup",
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages]
      },
      ...guild.roles.cache
        .filter((role) => role.name === "R4" || role.name === "R5")
        .map((role) => ({
          id: role.id,
          allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
        }))
    ]
  });

  const message = await channel.send(pendingRoleMessage(languages));
  for (const language of languages) {
    await message.react(languageEmoji(language));
  }

  await prisma.reactionRoleMessage.create({
    data: {
      guildId: guild.id,
      channelId: channel.id,
      messageId: message.id,
      languages
    }
  });

  await logToAdmin(guild, `Created reaction role message ${message.id} in <#${channel.id}>.`);
  await interaction.reply({ content: `Created reaction role message ${message.id} in <#${channel.id}>.`, ephemeral: true });
}

async function assignRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const messageId = interaction.options.getString("message-id", true);
  const language = interaction.options.getString("language", true) as Language;
  const role = interaction.options.getRole("role", true) as Role;
  const record = await prisma.reactionRoleMessage.findUnique({
    where: { messageId },
    include: { roles: true }
  });

  if (!record || record.guildId !== guild.id) {
    await interaction.reply({ content: "Reaction role message not found in this server.", ephemeral: true });
    return;
  }
  if (!record.languages.includes(language)) {
    await interaction.reply({ content: "That language is not part of this reaction role message.", ephemeral: true });
    return;
  }

  const existing = record.roles.find((assignment) => assignment.language === language);
  if (existing && existing.roleId !== role.id) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`roleassign:confirm:${messageId}:${language}:${role.id}:${interaction.user.id}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`roleassign:cancel:${messageId}:${language}:${role.id}:${interaction.user.id}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({
      content: `Replace current ${languageName(language)} role <@&${existing.roleId}> with <@&${role.id}>?`,
      components: [row],
      ephemeral: true
    });
    return;
  }

  await upsertRoleAssignment(messageId, guild.id, language, role.id);
  await refreshReactionRoleMessage(guild.id, messageId);
  await logToAdmin(guild, `${languageName(language)} reaction role set to <@&${role.id}> for message ${messageId}.`);
  await interaction.reply({ content: `Assigned ${languageName(language)} to <@&${role.id}>.`, ephemeral: true });
}

export async function confirmRoleAssignment(guildId: string, messageId: string, language: Language, roleId: string): Promise<void> {
  await upsertRoleAssignment(messageId, guildId, language, roleId);
  await refreshReactionRoleMessage(guildId, messageId);
}

async function upsertRoleAssignment(messageId: string, guildId: string, language: Language, roleId: string): Promise<void> {
  await prisma.reactionRoleAssignment.upsert({
    where: { messageId_language: { messageId, language } },
    create: { guildId, messageId, language, roleId },
    update: { roleId }
  });
}

async function addLanguage(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const messageId = interaction.options.getString("message-id", true);
  const language = interaction.options.getString("language", true) as Language;
  const record = await prisma.reactionRoleMessage.findUnique({ where: { messageId } });
  if (!record || record.guildId !== guild.id) {
    await interaction.reply({ content: "Reaction role message not found in this server.", ephemeral: true });
    return;
  }
  if (record.languages.includes(language)) {
    await interaction.reply({ content: `${languageName(language)} is already part of this reaction role message.`, ephemeral: true });
    return;
  }

  const channel = await guild.channels.fetch(record.channelId).catch(() => null);
  if (!channel?.isTextBased()) {
    await interaction.reply({ content: "The reaction role channel could not be found.", ephemeral: true });
    return;
  }

  const message = await (channel as GuildTextBasedChannel).messages.fetch(messageId).catch(() => null);
  if (!message) {
    await interaction.reply({ content: "The reaction role message could not be found in its channel.", ephemeral: true });
    return;
  }

  const languages = [...record.languages, language];
  await prisma.reactionRoleMessage.update({
    where: { messageId },
    data: { languages, status: "PENDING" }
  });
  await message.react(languageEmoji(language));
  await refreshReactionRoleMessage(guild.id, messageId);
  await logToAdmin(guild, `Added ${languageName(language)} to reaction role message ${messageId}.`);
  await interaction.reply({
    content: `Added ${languageName(language)} to the reaction role message. Assign a role for it with \`/roles assign\`.`,
    ephemeral: true
  });
}

async function removeLanguage(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const messageId = interaction.options.getString("message-id", true);
  const language = interaction.options.getString("language", true) as Language;
  const record = await prisma.reactionRoleMessage.findUnique({ where: { messageId } });
  if (!record || record.guildId !== guild.id) {
    await interaction.reply({ content: "Reaction role message not found in this server.", ephemeral: true });
    return;
  }

  const languages = record.languages.filter((item) => item !== language);
  await prisma.$transaction([
    prisma.reactionRoleAssignment.deleteMany({ where: { messageId, language } }),
    prisma.reactionRoleMessage.update({ where: { messageId }, data: { languages, status: "PENDING" } })
  ]);

  const channel = await guild.channels.fetch(record.channelId);
  if (channel?.isTextBased()) {
    const message = await (channel as GuildTextBasedChannel).messages.fetch(messageId).catch(() => null);
    await message?.reactions.resolve(languageEmoji(language))?.remove().catch(() => undefined);
  }

  await refreshReactionRoleMessage(guild.id, messageId);
  await logToAdmin(guild, `Removed ${languageName(language)} from reaction role message ${messageId}.`);
  await interaction.reply({ content: `Removed ${languageName(language)} from the reaction role message.`, ephemeral: true });
}

async function deleteReactionRoles(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const messageId = interaction.options.getString("message-id", true);
  const record = await prisma.reactionRoleMessage.findUnique({ where: { messageId } });
  if (!record || record.guildId !== guild.id) {
    await interaction.reply({ content: "Reaction role message not found in this server.", ephemeral: true });
    return;
  }

  await prisma.reactionRoleMessage.delete({ where: { messageId } });
  const channel = await guild.channels.fetch(record.channelId).catch(() => null);
  await channel?.delete("Reaction role setup deleted").catch(() => undefined);
  await logToAdmin(guild, `Deleted reaction role message ${messageId} and channel <#${record.channelId}>.`);
  await interaction.reply({ content: "Deleted the reaction role message and channel.", ephemeral: true });
}

export async function refreshReactionRoleMessage(guildId: string, messageId: string, client?: Client): Promise<void> {
  const record = await prisma.reactionRoleMessage.findUnique({
    where: { messageId },
    include: { roles: true }
  });
  if (!record || record.guildId !== guildId) return;

  const complete = record.languages.length > 0 && record.languages.every((language) => record.roles.some((role) => role.language === language));
  const status = complete ? "READY" : "PENDING";
  await prisma.reactionRoleMessage.update({ where: { messageId }, data: { status } });

  const guild = client
    ? await client.guilds.fetch(guildId).catch(() => null)
    : await import("../index.js").then((module) => module.client.guilds.fetch(guildId)).catch(() => null);
  const channel = guild ? await guild.channels.fetch(record.channelId).catch(() => null) : null;
  if (!channel?.isTextBased()) return;

  const message = await (channel as GuildTextBasedChannel).messages.fetch(messageId).catch(() => null);
  await message?.edit(reactionRoleMessagePayload(record.languages as SupportedLanguage[], complete)).catch(() => undefined);
}

export async function refreshAllReactionRoleMessages(client: Client): Promise<void> {
  const records = await prisma.reactionRoleMessage.findMany({ select: { guildId: true, messageId: true } });
  for (const record of records) {
    await refreshReactionRoleMessage(record.guildId, record.messageId, client);
  }
}
