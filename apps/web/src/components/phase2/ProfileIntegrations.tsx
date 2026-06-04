"use client";

import { useState } from "react";
import { generateLinkToken, unlinkAccount } from "@/app/actions/integrations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Send, LogOut, CheckCircle2, Disc } from "lucide-react";

interface ProfileIntegrationsProps {
  initialDiscord: { id?: string | null; username?: string | null };
  initialTelegram: { id?: string | null; username?: string | null };
}

export function ProfileIntegrations({ initialDiscord, initialTelegram }: ProfileIntegrationsProps) {
  const t = useTranslations("phase2.profile.integrations");
  const common = useTranslations("phase2.common");

  const [discord, setDiscord] = useState(initialDiscord);
  const [telegram, setTelegram] = useState(initialTelegram);

  const [discordCode, setDiscordCode] = useState<string | null>(null);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tgBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "tiles_survive_bot";

  const handleLink = async (type: "DISCORD" | "TELEGRAM") => {
    setLoading(true);
    try {
      const res = await generateLinkToken(type);
      if (res.success) {
        if (type === "DISCORD") {
          setDiscordCode(res.token);
        } else {
          setTelegramCode(res.token);
        }
        toast.success(t("codeGenerated"));
      }
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Failed to generate token");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (type: "DISCORD" | "TELEGRAM") => {
    const confirmed = confirm(t("confirmUnlink", { type }));
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await unlinkAccount(type);
      if (res.success) {
        if (type === "DISCORD") {
          setDiscord({ id: null, username: null });
          setDiscordCode(null);
        } else {
          setTelegram({ id: null, username: null });
          setTelegramCode(null);
        }
        toast.success(t("unlinkedSuccess", { type }));
      }
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Failed to unlink");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="grid gap-6 md:grid-cols-2">
        {/* DISCORD CARD */}
        <div className="rounded-lg border border-border-subtle bg-surface-2/30 p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Disc className="w-5 h-5 text-[#5865F2]" />
                <span className="font-bold text-sm text-text-primary">Discord</span>
              </div>
              {discord.id ? (
                <Badge className="bg-[#5865F2]/10 text-[#5865F2] hover:bg-[#5865F2]/10 border-none font-bold text-[10px]">
                  {common("yes")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted border-border-line text-[10px]">
                  {common("no")}
                </Badge>
              )}
            </div>

            {discord.id ? (
              <div className="space-y-1">
                <p className="text-xs text-muted">{t("connectedAs")}</p>
                <p className="text-sm font-semibold text-text-primary">@{discord.username}</p>
                <p className="text-[10px] text-muted">ID: {discord.id}</p>
              </div>
            ) : discordCode ? (
              <div className="rounded border border-[#5865F2]/30 bg-[#5865F2]/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-text-primary">{t("discordInstructionsTitle")}</p>
                <p className="text-xs text-muted leading-relaxed">
                  {t("discordInstructionsBody")}
                </p>
                <div className="flex items-center justify-center p-2 rounded bg-surface border border-border-line font-mono font-extrabold text-base tracking-wider text-gold select-all">
                  /link {discordCode}
                </div>
                <p className="text-[9px] text-[#5865F2]/80">{t("tokenExpiryHint")}</p>
              </div>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                {t("discordPromo")}
              </p>
            )}
          </div>

          <div className="pt-2">
            {discord.id ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
                onClick={() => handleUnlink("DISCORD")}
                disabled={loading}
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" /> {t("unlinkBtn")}
              </Button>
            ) : discordCode ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setDiscordCode(null)}
                disabled={loading}
              >
                {common("cancel")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold"
                onClick={() => handleLink("DISCORD")}
                disabled={loading}
              >
                <Disc className="w-4 h-4 mr-1.5" /> {t("linkBtn")}
              </Button>
            )}
          </div>
        </div>

        {/* TELEGRAM CARD */}
        <div className="rounded-lg border border-border-subtle bg-surface-2/30 p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-[#26A5E4]" />
                <span className="font-bold text-sm text-text-primary">Telegram</span>
              </div>
              {telegram.id ? (
                <Badge className="bg-[#26A5E4]/10 text-[#26A5E4] hover:bg-[#26A5E4]/10 border-none font-bold text-[10px]">
                  {common("yes")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted border-border-line text-[10px]">
                  {common("no")}
                </Badge>
              )}
            </div>

            {telegram.id ? (
              <div className="space-y-1">
                <p className="text-xs text-muted">{t("connectedAs")}</p>
                <p className="text-sm font-semibold text-text-primary">@{telegram.username}</p>
                <p className="text-[10px] text-muted">ID: {telegram.id}</p>
              </div>
            ) : telegramCode ? (
              <div className="rounded border border-[#26A5E4]/30 bg-[#26A5E4]/5 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-text-primary">{t("telegramInstructionsTitle")}</p>
                <p className="text-xs text-muted leading-relaxed">
                  {t("telegramInstructionsBody")}
                </p>
                <a
                  href={`https://t.me/${tgBotUsername}?start=${telegramCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2 rounded bg-surface border border-[#26A5E4]/30 font-semibold text-xs text-[#26A5E4] hover:bg-[#26A5E4]/5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> {t("openBotLink")}
                </a>
                <div className="text-center text-[10px] text-muted">
                  {t("telegramManualCode")} <code className="font-mono text-gold select-all font-bold px-1 py-0.5 rounded bg-surface border border-border-line">/start {telegramCode}</code>
                </div>
                <p className="text-[9px] text-[#26A5E4]/80">{t("tokenExpiryHint")}</p>
              </div>
            ) : (
              <p className="text-xs text-muted leading-relaxed">
                {t("telegramPromo")}
              </p>
            )}
          </div>

          <div className="pt-2">
            {telegram.id ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20"
                onClick={() => handleUnlink("TELEGRAM")}
                disabled={loading}
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" /> {t("unlinkBtn")}
              </Button>
            ) : telegramCode ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setTelegramCode(null)}
                disabled={loading}
              >
                {common("cancel")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full bg-[#26A5E4] hover:bg-[#1E8BBF] text-white font-semibold"
                onClick={() => handleLink("TELEGRAM")}
                disabled={loading}
              >
                <Send className="w-4 h-4 mr-1.5" /> {t("linkBtn")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-2/10 p-3.5 flex gap-2.5 items-start text-xs text-text-muted leading-relaxed">
        <CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" />
        <p>
          {t("integrationsFootnote")}
        </p>
      </div>
    </div>
  );
}
