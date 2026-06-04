import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@tiles-survive/database";
import { sendTelegramMessage } from "@/app/services/notifications";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message || !message.text || !message.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text).trim();

    // Match /start 123456 or /link 123456
    const startMatch = text.match(/^\/start\s+(\d{6})$/);
    const linkMatch = text.match(/^\/link\s+(\d{6})$/);
    const code = (startMatch ? startMatch[1] : null) || (linkMatch ? linkMatch[1] : null);

    if (!code) {
      // Just a normal message or command
      if (text.startsWith("/")) {
        await sendTelegramMessage(
          chatId,
          "Привет! Для привязки аккаунта введите команду <code>/link [код]</code> (код можно сгенерировать в вашем профиле на сайте)."
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Find the token in the database
    const linkToken = await prisma.linkToken.findUnique({
      where: { token: code },
      include: { user: true },
    });

    if (!linkToken || linkToken.type !== "TELEGRAM" || linkToken.expiresAt < new Date()) {
      await sendTelegramMessage(
        chatId,
        "❌ Неверный или просроченный код привязки. Пожалуйста, получите новый код на сайте."
      );
      return NextResponse.json({ ok: true });
    }

    // Update user in database
    await prisma.user.update({
      where: { id: linkToken.userId },
      data: {
        telegramId: chatId,
        telegramUsername: message.from.username || message.from.first_name || "Telegram User",
      },
    });

    // Delete token
    await prisma.linkToken.delete({
      where: { id: linkToken.id },
    });

    await sendTelegramMessage(
      chatId,
      `✅ Ваш Telegram аккаунт успешно привязан к профилю <b>${
        linkToken.user.username || linkToken.user.name
      }</b>!`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in telegram-webhook API route:", error);
    return NextResponse.json({ ok: true }); // Always return OK to Telegram so it doesn't retry on crash
  }
}
