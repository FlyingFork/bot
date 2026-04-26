import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { Command } from "@/types/index";
import { EMBED_COLOR, LANG_MAP, type LangChoice } from "@/utils/constants";
import db from "@/utils/db";

const LANG_CHOICES = [
  { name: "English", value: "english" },
  { name: "Russian", value: "russian" },
] as const;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("tg")
    .setDescription("Manage translation groups")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new translation group")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Unique name for this group")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("addchannel")
        .setDescription("Add a channel to a translation group")
        .addStringOption((opt) =>
          opt
            .setName("group")
            .setDescription("Name of the group")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to add")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("language")
            .setDescription("Language of this channel")
            .setRequired(true)
            .addChoices(...LANG_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("removechannel")
        .setDescription("Remove a channel from its translation group")
        .addStringOption((opt) =>
          opt
            .setName("group")
            .setDescription("Name of the group")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to remove")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete an entire translation group and all its channels")
        .addStringOption((opt) =>
          opt
            .setName("group")
            .setDescription("Name of the group to delete")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all translation groups in this server"),
    ) as SlashCommandBuilder,

  requiredRoles: ["R4", "R5"],

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: "This command can only be used inside a server.", ephemeral: true });
      return;
    }

    switch (sub) {
      case "create": {
        const name = interaction.options.getString("name", true).trim();
        await interaction.deferReply({ ephemeral: true });
        try {
          await db.translationGroup.create({ data: { guildId, name } });
          await interaction.editReply(`✅ Translation group **${name}** created. Use \`/tg addchannel\` to add channels.`);
        } catch {
          await interaction.editReply(`❌ A group named **${name}** already exists in this server.`);
        }
        break;
      }

      case "addchannel": {
        const groupName = interaction.options.getString("group", true).trim();
        const channel = interaction.options.getChannel("channel", true);
        const langChoice = interaction.options.getString("language", true) as LangChoice;
        const language = LANG_MAP[langChoice];

        await interaction.deferReply({ ephemeral: true });

        if (!(channel instanceof TextChannel)) {
          await interaction.editReply("❌ Only text channels can be added to translation groups.");
          return;
        }

        const group = await db.translationGroup.findUnique({
          where: { guildId_name: { guildId, name: groupName } },
        });

        if (!group) {
          await interaction.editReply(`❌ No group named **${groupName}** found in this server.`);
          return;
        }

        // Check if the channel is already in any group
        const existing = await db.translationChannel.findUnique({
          where: { channelId: channel.id },
          include: { group: true },
        });

        if (existing) {
          await interaction.editReply(
            `❌ <#${channel.id}> is already in group **${existing.group.name}**. Remove it first.`,
          );
          return;
        }

        await db.translationChannel.create({
          data: { channelId: channel.id, language, groupId: group.id },
        });

        const langLabel = Object.entries(LANG_MAP).find(([, v]) => v === language)?.[0] ?? language;
        await interaction.editReply(
          `✅ <#${channel.id}> added to **${groupName}** as **${langLabel}**.`,
        );
        break;
      }

      case "removechannel": {
        const groupName = interaction.options.getString("group", true).trim();
        const channel = interaction.options.getChannel("channel", true);

        await interaction.deferReply({ ephemeral: true });

        const record = await db.translationChannel.findFirst({
          where: { channelId: channel.id, group: { guildId, name: groupName } },
          include: { group: true },
        });

        if (!record) {
          await interaction.editReply(
            `❌ <#${channel.id}> is not in group **${groupName}**.`,
          );
          return;
        }

        await db.translationChannel.delete({ where: { id: record.id } });

        // Dissolve the group if it has fewer than 2 channels remaining
        const remaining = await db.translationChannel.count({
          where: { groupId: record.groupId },
        });
        if (remaining < 2) {
          await db.translationGroup.delete({ where: { id: record.groupId } });
          await interaction.editReply(
            `✅ <#${channel.id}> removed. Group **${groupName}** had fewer than 2 channels and was dissolved.`,
          );
        } else {
          await interaction.editReply(
            `✅ <#${channel.id}> removed from group **${groupName}**.`,
          );
        }
        break;
      }

      case "delete": {
        const groupName = interaction.options.getString("group", true).trim();
        await interaction.deferReply({ ephemeral: true });

        const group = await db.translationGroup.findUnique({
          where: { guildId_name: { guildId, name: groupName } },
        });

        if (!group) {
          await interaction.editReply(`❌ No group named **${groupName}** found in this server.`);
          return;
        }

        await db.translationGroup.delete({ where: { id: group.id } });
        await interaction.editReply(`✅ Group **${groupName}** and all its channels have been deleted.`);
        break;
      }

      case "list": {
        await interaction.deferReply({ ephemeral: true });

        const groups = await db.translationGroup.findMany({
          where: { guildId },
          include: { channels: true },
          orderBy: { name: "asc" },
        });

        if (groups.length === 0) {
          await interaction.editReply("No translation groups configured in this server. Use `/tg create` to get started.");
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("Translation Groups")
          .setColor(EMBED_COLOR)
          .setDescription(`${groups.length} group(s) in this server`);

        for (const group of groups.slice(0, 25)) {
          const channelLines = group.channels.map((ch) => {
            const langLabel =
              Object.entries(LANG_MAP).find(([, v]) => v === ch.language)?.[0] ??
              ch.language;
            return `<#${ch.channelId}> — ${langLabel}`;
          });
          embed.addFields({
            name: group.name,
            value: channelLines.length > 0 ? channelLines.join("\n") : "*(no channels)*",
            inline: false,
          });
        }

        if (groups.length > 25) {
          embed.setFooter({ text: `Showing first 25 of ${groups.length} groups.` });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.reply({ content: "Unknown subcommand.", ephemeral: true });
    }
  },
};

export default command;
