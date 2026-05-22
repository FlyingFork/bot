import { ChannelType, SlashCommandBuilder } from "discord.js";
import { setAdminLogChannel } from "../services/adminLog.js";
export const adminLogCommand = {
    data: new SlashCommandBuilder()
        .setName("admin-log")
        .setDescription("Configure the bot admin log channel")
        .addSubcommand((subcommand) => subcommand
        .setName("set")
        .setDescription("Set the admin log channel for this server")
        .addChannelOption((option) => option
        .setName("channel")
        .setDescription("Private admin log channel")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true))),
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild)
            return;
        const channel = interaction.options.getChannel("channel", true);
        await setAdminLogChannel(guild.id, channel.id);
        await interaction.reply({ content: `Admin logs will be sent to <#${channel.id}>.`, ephemeral: true });
    }
};
