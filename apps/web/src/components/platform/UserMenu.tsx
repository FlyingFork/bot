"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

interface UserMenuProps {
  username: string;
  role: string;
}

export function UserMenu({ username, role }: UserMenuProps) {
  const t = useTranslations("phase2.nav");
  const rolesT = useTranslations("phase2.roles");
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = (username[0] ?? "?").toUpperCase();
  const roleLabel = role === "admin" ? rolesT("admin") : role.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-2 transition-colors outline-none">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-bg font-semibold text-xs">
          {initials}
        </span>
        <span className="hidden sm:block text-text font-medium">{username}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-medium text-text">{username}</span>
          <span className="text-[11px] text-muted">{roleLabel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/profile")}
          className="flex items-center gap-2 cursor-pointer"
        >
          <User size={14} />
          {t("profile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex items-center gap-2 text-cn-danger focus:text-cn-danger cursor-pointer"
        >
          <LogOut size={14} />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
