"use server";

import { requireAdmin } from "@/lib/server-auth";
import { prisma } from "@tiles-survive/database";
import { sendDiscordDm, sendTelegramMessage } from "../services/notifications";

export async function getUsersWithIntegrations() {
  await requireAdmin();

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { discordId: { not: null } },
          { telegramId: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        discordId: true,
        discordUsername: true,
        telegramId: true,
        telegramUsername: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, users };
  } catch (error) {
    console.error("Failed to fetch users with integrations:", error);
    return { success: false, error: "Failed to fetch users" };
  }
}

export async function sendTestNotification({
  targetType,
  userId,
  rawId,
  platform,
  message,
}: {
  targetType: "USER" | "RAW";
  userId?: string;
  rawId?: string;
  platform: "DISCORD" | "TELEGRAM";
  message: string;
}) {
  await requireAdmin();

  if (!message.trim()) {
    return { success: false, error: "Message cannot be empty" };
  }

  let recipientId = "";

  if (targetType === "USER") {
    if (!userId) {
      return { success: false, error: "User is not selected" };
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, telegramId: true },
    });
    if (!user) {
      return { success: false, error: "User not found" };
    }
    if (platform === "DISCORD") {
      if (!user.discordId) {
        return { success: false, error: "Selected user has no linked Discord account" };
      }
      recipientId = user.discordId;
    } else {
      if (!user.telegramId) {
        return { success: false, error: "Selected user has no linked Telegram account" };
      }
      recipientId = user.telegramId;
    }
  } else {
    if (!rawId || !rawId.trim()) {
      return { success: false, error: "Recipient ID is missing" };
    }
    recipientId = rawId.trim();
  }

  let success = false;
  if (platform === "DISCORD") {
    success = await sendDiscordDm(recipientId, message);
  } else {
    success = await sendTelegramMessage(recipientId, message);
  }

  if (success) {
    return { success: true };
  } else {
    return {
      success: false,
      error: `Failed to send to ${platform}. Please check bot configuration and logs.`,
    };
  }
}
