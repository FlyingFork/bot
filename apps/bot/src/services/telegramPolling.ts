import { prisma } from "../db.js";

/**
 * Handles incoming Telegram updates from long polling.
 */
async function handleTelegramUpdate(update: any) {
  const message = update.message;
  if (!message || !message.text || !message.chat?.id) return;

  const chatId = String(message.chat.id);
  const text = String(message.text).trim();

  const startMatch = text.match(/^\/start\s+(\d{6})$/);
  const linkMatch = text.match(/^\/link\s+(\d{6})$/);
  const code = (startMatch ? startMatch[1] : null) || (linkMatch ? linkMatch[1] : null);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const reply = async (msg: string) => {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
      });
    } catch (e) {
      console.error("Failed to send Telegram reply:", e);
    }
  };

  if (!code) {
    if (text.startsWith("/")) {
      await reply("Привет! Для привязки аккаунта введите команду <code>/link [код]</code> (код можно сгенерировать в вашем профиле на сайте).");
    }
    return;
  }

  try {
    const linkToken = await prisma.linkToken.findUnique({
      where: { token: code },
      include: { user: true },
    });

    if (!linkToken || linkToken.type !== "TELEGRAM" || linkToken.expiresAt < new Date()) {
      await reply("❌ Неверный или просроченный код привязки. Пожалуйста, получите новый код на сайте.");
      return;
    }

    await prisma.user.update({
      where: { id: linkToken.userId },
      data: {
        telegramId: chatId,
        telegramUsername: message.from.username || message.from.first_name || "Telegram User",
      },
    });

    await prisma.linkToken.delete({
      where: { id: linkToken.id },
    });

    await reply(`✅ Ваш Telegram аккаунт успешно привязан к профилю <b>${linkToken.user.username || linkToken.user.name}</b>!`);
  } catch (err) {
    console.error("Failed to link Telegram account via polling:", err);
    await reply("Произошла техническая ошибка при привязке аккаунта. Обратитесь к администратору.");
  }
}

/**
 * Starts Telegram long polling if the TELEGRAM_BOT_TOKEN is set.
 */
export async function startTelegramPolling() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("Telegram polling: TELEGRAM_BOT_TOKEN not set, skipping polling.");
    return;
  }

  console.log("Telegram polling: starting Telegram long polling...");

  // Set webhook to empty first (required for long polling to work)
  try {
    await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=`);
  } catch (err) {
    console.error("Telegram polling: failed to clear webhook", err);
  }

  let offset = 0;

  const poll = async () => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`);
      if (!res.ok) {
        throw new Error(`getUpdates status ${res.status}`);
      }
      const data = (await res.json()) as any;
      if (data.ok && data.result.length > 0) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleTelegramUpdate(update);
        }
      }
    } catch (err) {
      console.error("Telegram polling error:", err);
      // Wait a bit before retrying on error
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    // Poll again
    setTimeout(poll, 100);
  };

  poll();
}
