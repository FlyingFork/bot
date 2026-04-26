import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { Command } from "@/types/index";
import { EMBED_COLOR, LANG_MAP, type LangChoice } from "@/utils/constants";
import db from "@/utils/db";
import { isOwnWebhook } from "@/utils/webhook";
import {
  getMessageChannelContext,
  processTranslationMessage,
} from "@/utils/messageProcessor";

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
        .setName("link")
        .setDescription("Create a group and link two channels in one step")
        .addStringOption((opt) =>
          opt
            .setName("group")
            .setDescription("Unique name for this group")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel_one")
            .setDescription("First channel to link")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("language_one")
            .setDescription("Language for the first channel")
            .setRequired(true)
            .addChoices(...LANG_CHOICES),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel_two")
            .setDescription("Second channel to link")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("language_two")
            .setDescription("Language for the second channel")
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
        .setName("forceprocess")
        .setDescription(
          "Force process an existing message as if bot was online",
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel where the message exists")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("ID of the message to process")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription(
          "Delete an entire translation group and all its channels",
        )
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
      await interaction.reply({
        content: "This command can only be used inside a server.",
        ephemeral: true,
      });
      return;
    }

    switch (sub) {
      case "create": {
        const name = interaction.options.getString("name", true).trim();
        await interaction.deferReply({ ephemeral: true });
        try {
          await db.translationGroup.create({ data: { guildId, name } });
          await interaction.editReply(
            `✅ Translation group **${name}** created. Use \`/tg addchannel\` to add channels.`,
          );
        } catch {
          await interaction.editReply(
            `❌ A group named **${name}** already exists in this server.`,
          );
        }
        break;
      }

      case "addchannel": {
        const groupName = interaction.options.getString("group", true).trim();
        const channel = interaction.options.getChannel("channel", true);
        const langChoice = interaction.options.getString(
          "language",
          true,
        ) as LangChoice;
        const language = LANG_MAP[langChoice];

        await interaction.deferReply({ ephemeral: true });

        if (!(channel instanceof TextChannel)) {
          await interaction.editReply(
            "❌ Only text channels can be added to translation groups.",
          );
          return;
        }

        const group = await db.translationGroup.findUnique({
          where: { guildId_name: { guildId, name: groupName } },
        });

        if (!group) {
          await interaction.editReply(
            `❌ No group named **${groupName}** found in this server.`,
          );
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

        const langLabel =
          Object.entries(LANG_MAP).find(([, v]) => v === language)?.[0] ??
          language;
        await interaction.editReply(
          `✅ <#${channel.id}> added to **${groupName}** as **${langLabel}**.`,
        );
        break;
      }

      case "link": {
        const groupName = interaction.options.getString("group", true).trim();
        const channelOne = interaction.options.getChannel("channel_one", true);
        const channelTwo = interaction.options.getChannel("channel_two", true);
        const langChoiceOne = interaction.options.getString(
          "language_one",
          true,
        ) as LangChoice;
        const langChoiceTwo = interaction.options.getString(
          "language_two",
          true,
        ) as LangChoice;
        const languageOne = LANG_MAP[langChoiceOne];
        const languageTwo = LANG_MAP[langChoiceTwo];

        await interaction.deferReply({ ephemeral: true });

        if (
          !(channelOne instanceof TextChannel) ||
          !(channelTwo instanceof TextChannel)
        ) {
          await interaction.editReply(
            "❌ Only text channels can be linked in translation groups.",
          );
          return;
        }

        if (channelOne.id === channelTwo.id) {
          await interaction.editReply(
            "❌ Please select two different channels.",
          );
          return;
        }

        if (languageOne === languageTwo) {
          await interaction.editReply(
            "❌ Please choose different languages for each channel.",
          );
          return;
        }

        const [groupExists, existingChannels] = await Promise.all([
          db.translationGroup.findUnique({
            where: { guildId_name: { guildId, name: groupName } },
          }),
          db.translationChannel.findMany({
            where: { channelId: { in: [channelOne.id, channelTwo.id] } },
            include: { group: true },
          }),
        ]);

        if (groupExists) {
          await interaction.editReply(
            `❌ A group named **${groupName}** already exists in this server.`,
          );
          return;
        }

        if (existingChannels.length > 0) {
          const lines = existingChannels.map(
            (record) =>
              `• <#${record.channelId}> is already in **${record.group.name}**`,
          );
          await interaction.editReply(
            `❌ One or more channels are already linked:\n${lines.join("\n")}`,
          );
          return;
        }

        await db.$transaction(async (tx) => {
          const group = await tx.translationGroup.create({
            data: { guildId, name: groupName },
          });

          await tx.translationChannel.createMany({
            data: [
              {
                channelId: channelOne.id,
                language: languageOne,
                groupId: group.id,
              },
              {
                channelId: channelTwo.id,
                language: languageTwo,
                groupId: group.id,
              },
            ],
          });
        });

        await interaction.editReply(
          `✅ Linked <#${channelOne.id}> (${langChoiceOne}) ↔ <#${channelTwo.id}> (${langChoiceTwo}) in **${groupName}**.`,
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

      case "forceprocess": {
        const channel = interaction.options.getChannel("channel", true);
        const messageId = interaction.options
          .getString("message_id", true)
          .trim();

        await interaction.deferReply({ ephemeral: true });

        if (
          !(channel instanceof TextChannel) &&
          !(channel instanceof ThreadChannel)
        ) {
          await interaction.editReply(
            "❌ Please select a text channel or thread that contains the target message.",
          );
          return;
        }

        const message = await channel.messages
          .fetch(messageId)
          .catch(() => null);
        if (!message) {
          await interaction.editReply(
            `❌ Message **${messageId}** was not found in <#${channel.id}>.`,
          );
          return;
        }

        if (!message.guild || message.guild.id !== guildId) {
          await interaction.editReply(
            "❌ This message does not belong to this server.",
          );
          return;
        }

        if (message.author.bot || message.system) {
          await interaction.editReply(
            "❌ Bot and system messages cannot be force processed.",
          );
          return;
        }

        if (message.webhookId && isOwnWebhook(message.webhookId)) {
          await interaction.editReply(
            "❌ Messages sent by this bot webhook cannot be force processed.",
          );
          return;
        }

        const channelContext = getMessageChannelContext(message);
        if (!channelContext) {
          await interaction.editReply(
            "❌ Only text channel and thread messages are supported.",
          );
          return;
        }

        const sourceRecord = await db.translationChannel.findUnique({
          where: { channelId: channelContext.effectiveChannelId },
        });
        if (!sourceRecord) {
          await interaction.editReply(
            `❌ <#${channelContext.effectiveChannelId}> is not part of a translation group.`,
          );
          return;
        }

        const group = await db.translationGroup.findUnique({
          where: { id: sourceRecord.groupId },
          include: { channels: true },
        });

        if (!group || group.guildId !== guildId) {
          await interaction.editReply(
            "❌ The translation group for this message could not be resolved.",
          );
          return;
        }

        const result = await processTranslationMessage(
          message,
          sourceRecord,
          group,
          {
            contextTag: "forceprocess",
            skipRateLimit: true,
            allowMismatchDelete: true,
            notifyTranslationFailureToAuthor: false,
            channelContext,
          },
        );

        if (result.reason === "no-targets") {
          await interaction.editReply(
            "❌ No sibling channels are available in this translation group.",
          );
          return;
        }

        if (result.reason === "no-content") {
          await interaction.editReply(
            "❌ This message has no text, attachments, or stickers to process.",
          );
          return;
        }

        await interaction.editReply(
          `✅ Force processed message **${message.id}** from <#${message.channelId}> and forwarded to **${result.forwardedCount}** channel(s)${result.mismatchDetected ? " (language mismatch flow)." : "."}`,
        );
        break;
      }

      case "delete": {
        const groupName = interaction.options.getString("group", true).trim();
        await interaction.deferReply({ ephemeral: true });

        const group = await db.translationGroup.findUnique({
          where: { guildId_name: { guildId, name: groupName } },
        });

        if (!group) {
          await interaction.editReply(
            `❌ No group named **${groupName}** found in this server.`,
          );
          return;
        }

        await db.translationGroup.delete({ where: { id: group.id } });
        await interaction.editReply(
          `✅ Group **${groupName}** and all its channels have been deleted.`,
        );
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
          await interaction.editReply(
            "No translation groups configured in this server. Use `/tg create` to get started.",
          );
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle("Translation Groups")
          .setColor(EMBED_COLOR)
          .setDescription(`${groups.length} group(s) in this server`);

        for (const group of groups.slice(0, 25)) {
          const channelLines = group.channels.map((ch) => {
            const langLabel =
              Object.entries(LANG_MAP).find(
                ([, v]) => v === ch.language,
              )?.[0] ?? ch.language;
            return `<#${ch.channelId}> — ${langLabel}`;
          });
          embed.addFields({
            name: group.name,
            value:
              channelLines.length > 0
                ? channelLines.join("\n")
                : "*(no channels)*",
            inline: false,
          });
        }

        if (groups.length > 25) {
          embed.setFooter({
            text: `Showing first 25 of ${groups.length} groups.`,
          });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.reply({
          content: "Unknown subcommand.",
          ephemeral: true,
        });
    }
  },
};

export default command;
