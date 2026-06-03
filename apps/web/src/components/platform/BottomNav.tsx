"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard, Swords, Droplets, Bell, Menu, X,
  Users, BarChart2, Trophy, Upload, ShieldCheck,
  ListChecks, UserCog, ScrollText, Settings2, CalendarRange, Gauge, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasRole } from "@/lib/roles";

interface BottomNavProps {
  role: string;
  unreadCount?: number;
}

function NavItem({ href, icon: Icon, label, badge }: { href: string; icon: React.ElementType; label: string; badge?: number }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors min-w-[44px]",
        isActive ? "text-gold" : "text-muted hover:text-text",
      )}
    >
      <span className="relative">
        <Icon size={20} strokeWidth={1.5} />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-gold px-0.5 text-[8px] font-bold leading-none text-bg">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function DrawerLink({ href, icon: Icon, label, close }: { href: string; icon: React.ElementType; label: string; close: () => void }) {
  return (
    <Link
      href={href}
      onClick={close}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-muted hover:bg-surface-2 hover:text-text transition-colors"
    >
      <Icon size={16} strokeWidth={1.5} />
      {label}
    </Link>
  );
}

export function BottomNav({ role, unreadCount = 0 }: BottomNavProps) {
  const t = useTranslations("phase2.nav");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isR4Plus = hasRole(role, "r4");
  const isAdmin = role === "admin";

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border-line bg-surface flex items-center justify-around safe-pb">
        <NavItem href="/dashboard" icon={LayoutDashboard} label={t("home")} />
        <NavItem href="/events/alliance-duel" icon={Swords} label="Duel" />
        <NavItem href="/events/reservoir-raid" icon={Droplets} label="Raid" />
        <NavItem href="/notifications" icon={Bell} label={t("alerts")} badge={unreadCount} />
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium text-muted hover:text-text transition-colors min-w-[44px]"
          aria-label={t("menu")}
        >
          <Menu size={20} strokeWidth={1.5} />
          <span>{t("menu")}</span>
        </button>
      </nav>

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative bg-surface border-t border-border-line rounded-t-2xl overflow-hidden animate-fade-up">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border-strong" />
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-line">
              <span className="font-semibold text-text text-sm">{t("navigation")}</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-muted hover:text-text min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="flex flex-col p-2 gap-0.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
              <DrawerLink href="/stats" icon={BarChart2} label={t("stats")} close={() => setDrawerOpen(false)} />
              {isR4Plus && <DrawerLink href="/members" icon={Users} label={t("members")} close={() => setDrawerOpen(false)} />}
              {isR4Plus && <DrawerLink href="/leaderboards" icon={Trophy} label={t("leaderboards")} close={() => setDrawerOpen(false)} />}
              {isR4Plus && <DrawerLink href="/scores/reservoir-raid" icon={Gauge} label={t("rrsScores")} close={() => setDrawerOpen(false)} />}
              {isAdmin ? (
                <>
                  <DrawerLink href="/seasons" icon={CalendarRange} label={t("seasons")} close={() => setDrawerOpen(false)} />
                  <div className="pl-4">
                    <DrawerLink href="/seasons/boosts" icon={Zap} label={t("boosts")} close={() => setDrawerOpen(false)} />
                  </div>
                </>
              ) : (
                <DrawerLink href="/seasons/boosts" icon={Zap} label={t("boosts")} close={() => setDrawerOpen(false)} />
              )}
              {isR4Plus && <DrawerLink href="/upload" icon={Upload} label={t("upload")} close={() => setDrawerOpen(false)} />}
              {isAdmin && (
                <>
                  <p className="text-[11px] font-normal tracking-[0.07em] uppercase text-muted px-3 pt-3 pb-1">{t("admin")}</p>
                  <DrawerLink href="/admin/verifications" icon={ShieldCheck} label={t("verifications")} close={() => setDrawerOpen(false)} />
                  <DrawerLink href="/admin/upload-requests" icon={ListChecks} label={t("uploadRequests")} close={() => setDrawerOpen(false)} />
                  <DrawerLink href="/admin/users" icon={Users} label={t("users")} close={() => setDrawerOpen(false)} />
                  <DrawerLink href="/admin/members" icon={UserCog} label={t("members")} close={() => setDrawerOpen(false)} />
                  <DrawerLink href="/admin/audit-log" icon={ScrollText} label={t("auditLog")} close={() => setDrawerOpen(false)} />
                  <DrawerLink href="/admin/settings" icon={Settings2} label={t("settings")} close={() => setDrawerOpen(false)} />
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
