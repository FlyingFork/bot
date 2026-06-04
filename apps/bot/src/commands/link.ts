import { SlashCommandBuilder } from "discord.js";
import { prisma } from "../db.js";
import type { BotCommand } from "./types.js";

export const linkCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to the platform using a verification code")
    .addStringOption((option) =>
      option
        .setName("code")
        .setDescription("The 6-digit linking code shown in your profile")
        .setRequired(true)
    ),
  async execute(interaction) {
    const code = interaction.options.getString("code", true).trim();

    // Defer reply so we can query database
    await interaction.deferReply({ ephemeral: true });

    try {
      // Find the token
      const linkToken = await prisma.linkToken.findUnique({
        where: { token: code },
        include: { user: true },
      });

      if (!linkToken || linkToken.type !== "DISCORD" || linkToken.expiresAt < new Date()) {
        await interaction.editReply({
          content: "Неверный или просроченный код привязки. Пожалуйста, сгенерируйте новый код в профиле на сайте.",
        });
        return;
      }

      // Update the user
      await prisma.user.update({
        where: { id: linkToken.userId },
        data: {
          discordId: interaction.user.id,
          discordUsername: interaction.user.tag,
        },
      });

      // Delete the token
      await prisma.linkToken.delete({
        where: { id: linkToken.id },
      });

      await interaction.editReply({
        content: `Ваш аккаунт Discord успешно привязан к профилю **${linkToken.user.username || linkToken.user.name}**!`,
      });
    } catch (error) {
      console.error("Failed to link Discord account via command:", error);
      await interaction.editReply({
        content: "Произошла техническая ошибка при привязке аккаунта. Обратитесь к администратору.",
      });
    }
  },
};
