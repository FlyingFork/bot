import { ChannelType, SlashCommandBuilder } from "discord.js";
import { prisma } from "../db.js";
import { cleanupWebhookIfUnused, ensureManagedWebhook, canUseWebhook } from "../services/webhooks.js";
import { logToAdmin } from "../services/adminLog.js";
import { languageChoices } from "./options.js";
import { languageName } from "../constants/languages.js";
export const groupCommand = {
    data: new SlashCommandBuilder()
        .setName("group")
        .setDescription("Manage translation channel groups")
        .addSubcommand((subcommand) => subcommand
        .setName("create")
        .setDescription("Create a translation group with two channels")
        .addStringOption((option) => option.setName("group-name").setDescription("Unique group name").setRequired(true))
        .addChannelOption((option) => option.setName("channel-1").setDescription("First channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        .addStringOption((option) => option.setName("language-1").setDescription("First channel language").addChoices(...languageChoices).setRequired(true))
        .addChannelOption((option) => option.setName("channel-2").setDescription("Second channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        .addStringOption((option) => option.setName("language-2").setDescription("Second channel language").addChoices(...languageChoices).setRequired(true)))
        .addSubcommand((subcommand) => subcommand
        .setName("add-channel")
        .setDescription("Add a channel to an existing translation group")
        .addStringOption((option) => option.setName("group-name").setDescription("Existing group name").setRequired(true))
        .addChannelOption((option) => option.setName("channel").setDescription("Channel to add").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        .addStringOption((option) => option.setName("language").setDescription("Channel language").addChoices(...languageChoices).setRequired(true)))
        .addSubcommand((subcommand) => subcommand
        .setName("remove-channel")
        .setDescription("Remove a channel from a translation group")
        .addChannelOption((option) => option.setName("channel").setDescription("Channel to remove").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
        .addStringOption((option) => option.setName("group-name").setDescription("Required if channel belongs to multiple groups").setRequired(false)))
        .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List translation groups"))
        .addSubcommand((subcommand) => subcommand
        .setName("channel-groups")
        .setDescription("List groups a channel belongs to")
        .addChannelOption((option) => option.setName("channel").setDescription("Channel").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "create")
            return createGroup(interaction);
        if (subcommand === "add-channel")
            return addChannel(interaction);
        if (subcommand === "remove-channel")
            return removeChannel(interaction);
        if (subcommand === "list")
            return listGroups(interaction);
        if (subcommand === "channel-groups")
            return listChannelGroups(interaction);
    }
};
async function createGroup(interaction) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const name = interaction.options.getString("group-name", true).trim();
    const channel1 = interaction.options.getChannel("channel-1", true);
    const channel2 = interaction.options.getChannel("channel-2", true);
    const language1 = interaction.options.getString("language-1", true);
    const language2 = interaction.options.getString("language-2", true);
    if (language1 === language2) {
        await interaction.reply({ content: "The two channels must use different languages.", ephemeral: true });
        return;
    }
    if (channel1.id === channel2.id) {
        await interaction.reply({ content: "The two initial channels must be different.", ephemeral: true });
        return;
    }
    const duplicate = await prisma.translationGroup.findUnique({ where: { guildId_name: { guildId: guild.id, name } } });
    if (duplicate) {
        await interaction.reply({ content: "A group with that name already exists in this server.", ephemeral: true });
        return;
    }
    const channelLanguageConflict = await prisma.groupChannel.findFirst({
        where: {
            guildId: guild.id,
            OR: [
                { channelId: channel1.id, language: language1 },
                { channelId: channel2.id, language: language2 }
            ]
        }
    });
    if (channelLanguageConflict) {
        await interaction.reply({ content: "One of those channels is already assigned that language in another group.", ephemeral: true });
        return;
    }
    await ensureWebhookForGuildChannel(channel1);
    await ensureWebhookForGuildChannel(channel2);
    await prisma.translationGroup.create({
        data: {
            guildId: guild.id,
            name,
            channels: {
                create: [
                    { guildId: guild.id, channelId: channel1.id, language: language1 },
                    { guildId: guild.id, channelId: channel2.id, language: language2 }
                ]
            }
        }
    });
    await logToAdmin(guild, `Translation group "${name}" created with <#${channel1.id}> and <#${channel2.id}>.`);
    await interaction.reply({ content: `Created group "${name}".`, ephemeral: true });
}
async function addChannel(interaction) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const groupName = interaction.options.getString("group-name", true).trim();
    const channel = interaction.options.getChannel("channel", true);
    const language = interaction.options.getString("language", true);
    const group = await prisma.translationGroup.findUnique({
        where: { guildId_name: { guildId: guild.id, name: groupName } },
        include: { channels: true }
    });
    if (!group) {
        await interaction.reply({ content: "That group does not exist.", ephemeral: true });
        return;
    }
    if (group.channels.some((row) => row.channelId === channel.id)) {
        await interaction.reply({ content: "That channel is already in the group.", ephemeral: true });
        return;
    }
    if (group.channels.some((row) => row.language === language)) {
        await interaction.reply({ content: "That language is already represented in the group.", ephemeral: true });
        return;
    }
    const conflict = await prisma.groupChannel.findUnique({
        where: { guildId_channelId_language: { guildId: guild.id, channelId: channel.id, language } }
    });
    if (conflict) {
        await interaction.reply({ content: "That channel is already assigned that language in another group.", ephemeral: true });
        return;
    }
    await ensureWebhookForGuildChannel(channel);
    await prisma.groupChannel.create({ data: { guildId: guild.id, groupId: group.id, channelId: channel.id, language } });
    await logToAdmin(guild, `<#${channel.id}> added to translation group "${groupName}" as ${languageName(language)}.`);
    await interaction.reply({ content: `Added <#${channel.id}> to "${groupName}".`, ephemeral: true });
}
async function removeChannel(interaction) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const channel = interaction.options.getChannel("channel", true);
    const groupName = interaction.options.getString("group-name");
    const memberships = await prisma.groupChannel.findMany({
        where: {
            guildId: guild.id,
            channelId: channel.id,
            ...(groupName ? { group: { name: groupName } } : {})
        },
        include: { group: { include: { channels: true } } }
    });
    if (memberships.length === 0) {
        await interaction.reply({ content: "That channel is not in a matching translation group.", ephemeral: true });
        return;
    }
    if (!groupName && memberships.length > 1) {
        await interaction.reply({ content: "That channel belongs to multiple groups. Provide `group-name`.", ephemeral: true });
        return;
    }
    const membership = memberships[0];
    await prisma.groupChannel.delete({ where: { id: membership.id } });
    const remaining = await prisma.groupChannel.count({ where: { groupId: membership.groupId } });
    let suffix = "";
    if (remaining <= 1) {
        await prisma.translationGroup.delete({ where: { id: membership.groupId } });
        suffix = " The group had only one channel remaining and was deleted.";
    }
    await cleanupWebhookIfUnused(guild.id, channel.id);
    await logToAdmin(guild, `<#${channel.id}> removed from translation group "${membership.group.name}".${suffix}`);
    await interaction.reply({ content: `Removed <#${channel.id}> from "${membership.group.name}".${suffix}`, ephemeral: true });
}
async function listGroups(interaction) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const groups = await prisma.translationGroup.findMany({
        where: { guildId: guild.id },
        include: { channels: true },
        orderBy: { name: "asc" }
    });
    const content = groups.length
        ? groups.map((group) => `**${group.name}**: ${group.channels.map((channel) => `<#${channel.channelId}> ${languageName(channel.language)}`).join(", ")}`).join("\n")
        : "No translation groups configured.";
    await interaction.reply({ content: content.slice(0, 2000), ephemeral: true });
}
async function listChannelGroups(interaction) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const channel = interaction.options.getChannel("channel", true);
    const memberships = await prisma.groupChannel.findMany({
        where: { guildId: guild.id, channelId: channel.id },
        include: { group: true }
    });
    if (memberships.length <= 1) {
        await interaction.reply({ content: "This command is only useful for channels in more than one group.", ephemeral: true });
        return;
    }
    await interaction.reply({
        content: memberships.map((membership) => `${membership.group.name}: ${languageName(membership.language)}`).join("\n"),
        ephemeral: true
    });
}
async function ensureWebhookForGuildChannel(channel) {
    if (!canUseWebhook(channel)) {
        throw new Error("Channel does not support managed webhooks");
    }
    await ensureManagedWebhook(channel);
}
