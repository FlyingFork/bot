"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Send,
  X,
  Disc,
  MessageSquare,
  Loader2,
  Terminal,
  User,
  Hash,
} from "lucide-react";
import {
  getUsersWithIntegrations,
  sendTestNotification,
} from "@/app/actions/admin-test";

interface UserOption {
  id: string;
  name: string | null;
  username: string | null;
  discordId: string | null;
  discordUsername: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
}

interface AdminTestPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminTestPanel({ open, onOpenChange }: AdminTestPanelProps) {
  const t = useTranslations("phase2.adminTestPanel");
  const common = useTranslations("phase2.common");

  const [platform, setPlatform] = useState<"DISCORD" | "TELEGRAM">("DISCORD");
  const [targetType, setTargetType] = useState<"USER" | "RAW">("USER");
  const [userId, setUserId] = useState<string>("");
  const [rawId, setRawId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [users, setUsers] = useState<UserOption[]>([]);
  
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);

  // Load users when open or targetType/platform changes
  useEffect(() => {
    if (open && targetType === "USER") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingUsers(true);
      getUsersWithIntegrations()
        .then((res) => {
          if (res.success && res.users) {
            setUsers(res.users);
            if (res.users.length > 0) {
              // Pre-select first user that has the active platform integration
              const activePlatformUsers = res.users.filter(u => 
                platform === "DISCORD" ? u.discordId : u.telegramId
              );
              if (activePlatformUsers.length > 0) {
                setUserId(activePlatformUsers[0].id);
              } else {
                setUserId(res.users[0].id);
              }
            }
          } else {
            toast.error(res.error || "Failed to load users");
          }
        })
        .catch((err) => {
          console.error(err);
          toast.error("Failed to load users");
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    }
  }, [open, targetType, platform]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(t("errorEmptyMessage") || "Message cannot be empty");
      return;
    }

    setSending(true);
    try {
      const res = await sendTestNotification({
        targetType,
        userId: targetType === "USER" ? userId : undefined,
        rawId: targetType === "RAW" ? rawId : undefined,
        platform,
        message,
      });

      if (res.success) {
        toast.success(t("successToast"));
        setMessage("");
      } else {
        toast.error(res.error || "Failed to send notification");
      }
    } catch (error) {
      const err = error as Error;
      console.error(err);
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setSending(false);
    }
  };

  // Filter users based on platform selection
  const filteredUsers = users.filter(u => 
    platform === "DISCORD" ? u.discordId !== null : u.telegramId !== null
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col h-full bg-surface border-l border-border-subtle p-0 w-full max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Terminal className="w-4.5 h-4.5 text-gold" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-text-primary">
                {t("title")}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted">
                {t("description")}
              </SheetDescription>
            </div>
          </div>
          <SheetClose className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text transition-colors">
            <X className="w-4 h-4" />
          </SheetClose>
        </SheetHeader>

        <form onSubmit={handleSend} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* PLATFORM SWITCH */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("platform")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPlatform("DISCORD")}
                className={`flex items-center justify-center gap-2 h-9 rounded-md border text-sm font-semibold transition-all ${
                  platform === "DISCORD"
                    ? "bg-[#5865F2]/10 border-[#5865F2]/40 text-[#5865F2] shadow-sm shadow-[#5865F2]/10"
                    : "bg-surface-2/40 border-border-line text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <Disc className="w-4 h-4" />
                Discord
              </button>
              <button
                type="button"
                onClick={() => setPlatform("TELEGRAM")}
                className={`flex items-center justify-center gap-2 h-9 rounded-md border text-sm font-semibold transition-all ${
                  platform === "TELEGRAM"
                    ? "bg-[#26A5E4]/10 border-[#26A5E4]/40 text-[#26A5E4] shadow-sm shadow-[#26A5E4]/10"
                    : "bg-surface-2/40 border-border-line text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <Send className="w-4 h-4" />
                Telegram
              </button>
            </div>
          </div>

          {/* TARGET TYPE SWITCH */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("targetType")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType("USER")}
                className={`flex items-center justify-center gap-1.5 h-8 rounded-md border text-xs font-medium transition-all ${
                  targetType === "USER"
                    ? "bg-gold/10 border-gold/30 text-gold font-semibold"
                    : "bg-surface-2/20 border-transparent text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                {t("linkedUser")}
              </button>
              <button
                type="button"
                onClick={() => setTargetType("RAW")}
                className={`flex items-center justify-center gap-1.5 h-8 rounded-md border text-xs font-medium transition-all ${
                  targetType === "RAW"
                    ? "bg-gold/10 border-gold/30 text-gold font-semibold"
                    : "bg-surface-2/20 border-transparent text-muted hover:text-text hover:bg-surface-2"
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                {t("rawId")}
              </button>
            </div>
          </div>

          {/* RECIPIENT SELECT / INPUT */}
          {targetType === "USER" ? (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                {t("recipientUser")}
              </label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 h-8 text-xs text-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {common("saving")}
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="relative">
                  <select
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="h-9 w-full rounded-md border border-border-line bg-surface-2 px-3 text-sm text-text font-sans outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold-bg transition-colors"
                  >
                    {filteredUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.username} (@
                        {platform === "DISCORD"
                          ? user.discordUsername
                          : user.telegramUsername}
                        )
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 text-xs text-center border border-dashed border-border-line rounded-md text-muted">
                  {t("noLinkedUsers")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                {platform === "DISCORD" ? t("rawDiscordId") : t("rawTelegramId")}
              </label>
              <Input
                placeholder={
                  platform === "DISCORD"
                    ? "123456789012345678"
                    : "123456789"
                }
                value={rawId}
                onChange={(e) => setRawId(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          {/* MESSAGE CONTENT */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("messageText")}
            </label>
            <textarea
              rows={4}
              placeholder={t("messagePlaceholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-[100px] rounded-md border border-border-line bg-surface-2 px-3 py-2 text-sm text-text font-sans placeholder:text-dim transition-colors outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold-bg"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <Button
            type="submit"
            disabled={
              sending ||
              (targetType === "USER" && filteredUsers.length === 0) ||
              (targetType === "RAW" && !rawId.trim()) ||
              !message.trim()
            }
            className="w-full h-10 font-bold bg-gold hover:bg-gold-dim text-bg flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("sending")}
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                {t("sendBtn")}
              </>
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
