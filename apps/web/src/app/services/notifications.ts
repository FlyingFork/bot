import { prisma } from "@tiles-survive/database";

/**
 * Sends a Direct Message to a Discord user.
 */
export async function sendDiscordDm(discordId: string, message: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
  if (!token) {
    console.warn("Discord token is missing from environment variables.");
    return false;
  }

  try {
    // 1. Create DM channel
    const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });

    if (!dmRes.ok) {
      const errText = await dmRes.text();
      console.error(`Discord DM channel creation failed: ${dmRes.status} ${errText}`);
      return false;
    }

    const channel = await dmRes.json();

    // 2. Send message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: message }),
    });

    if (!msgRes.ok) {
      const errText = await msgRes.text();
      console.error(`Discord DM message sending failed: ${msgRes.status} ${errText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Discord DM:", error);
    return false;
  }
}

/**
 * Sends a message to a Telegram user.
 */
export async function sendTelegramMessage(telegramId: string, message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("Telegram bot token is missing from environment variables.");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Telegram sendMessage failed: ${res.status} ${errText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return false;
  }
}

/**
 * Sends a notification to all linked accounts of a user (Discord, Telegram).
 */
export async function notifyUser(userId: string, message: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { discordId: true, telegramId: true },
    });

    if (!user) return;

    const promises = [];
    if (user.discordId) {
      promises.push(sendDiscordDm(user.discordId, message));
    }
    if (user.telegramId) {
      promises.push(sendTelegramMessage(user.telegramId, message));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  } catch (error) {
    console.error("Failed to execute notifyUser:", error);
  }
}
