"use client";

import { useTranslations } from "next-intl";
import {
  LayoutDashboard, Users, BarChart2, Trophy, CalendarRange,
  Upload, Swords, Droplets, Bell, ShieldCheck, ListChecks,
  UserCog, ScrollText, Settings2,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { hasRole } from "@/lib/roles";

interface SidebarProps {
  role: string;
  allianceName: string;
}

export function Sidebar({ role, allianceName }: SidebarProps) {
  const t = useTranslations("phase2.nav");
  const isAdmin = role === "admin";
  const isR4Plus = hasRole(role, "r4");

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 border-r border-border-line bg-surface flex-col">
      <div className="flex items-center gap-2 px-3.5 py-4 border-b border-border-line">
        <div className="w-7 h-7 bg-gold rounded-md flex items-center justify-center text-bg font-extrabold text-[10px] shrink-0">
          TS
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-text truncate">
          {allianceName || "Tiles Survive"}
        </span>
      </div>

      <nav className="flex flex-col flex-1 pt-2 pb-4 overflow-y-auto px-2">
        <NavLink href="/dashboard" exact>
          <LayoutDashboard size={16} strokeWidth={1.5} className="shrink-0" />
          {t("dashboard")}
        </NavLink>

        {isR4Plus && (
          <NavLink href="/members">
            <Users size={16} strokeWidth={1.5} className="shrink-0" />
            {t("members")}
          </NavLink>
        )}

        <NavLink href="/stats">
          <BarChart2 size={16} strokeWidth={1.5} className="shrink-0" />
          {t("stats")}
        </NavLink>

        {isR4Plus && (
          <NavLink href="/leaderboards">
            <Trophy size={16} strokeWidth={1.5} className="shrink-0" />
            {t("leaderboards")}
          </NavLink>
        )}

        {isAdmin && (
          <NavLink href="/seasons">
            <CalendarRange size={16} strokeWidth={1.5} className="shrink-0" />
            {t("seasons")}
          </NavLink>
        )}

        {isR4Plus && (
          <NavLink href="/upload">
            <Upload size={16} strokeWidth={1.5} className="shrink-0" />
            {t("upload")}
          </NavLink>
        )}

        <div className="h-px bg-border-line my-1.5 mx-1" />

        <p className="text-[11px] font-normal tracking-[0.07em] uppercase text-muted px-2.5 pt-2 pb-1">
          {t("events")}
        </p>

        <NavLink href="/events/alliance-duel">
          <Swords size={16} strokeWidth={1.5} className="shrink-0" />
          {t("allianceDuel")}
        </NavLink>

        <NavLink href="/events/reservoir-raid">
          <Droplets size={16} strokeWidth={1.5} className="shrink-0" />
          {t("reservoirRaid")}
        </NavLink>

        <NavLink href="/notifications">
          <Bell size={16} strokeWidth={1.5} className="shrink-0" />
          {t("notifications")}
        </NavLink>

        {isAdmin && (
          <>
            <div className="h-px bg-border-line my-1.5 mx-1" />
            <p className="text-[11px] font-normal tracking-[0.07em] uppercase text-muted px-2.5 pt-2 pb-1">
              {t("admin")}
            </p>
            <NavLink href="/admin/verifications">
              <ShieldCheck size={16} strokeWidth={1.5} className="shrink-0" />
              {t("verifications")}
            </NavLink>
            <NavLink href="/admin/upload-requests">
              <ListChecks size={16} strokeWidth={1.5} className="shrink-0" />
              {t("uploadRequests")}
            </NavLink>
            <NavLink href="/admin/users">
              <Users size={16} strokeWidth={1.5} className="shrink-0" />
              {t("users")}
            </NavLink>
            <NavLink href="/admin/members">
              <UserCog size={16} strokeWidth={1.5} className="shrink-0" />
              {t("members")}
            </NavLink>
            <NavLink href="/admin/audit-log">
              <ScrollText size={16} strokeWidth={1.5} className="shrink-0" />
              {t("auditLog")}
            </NavLink>
            <NavLink href="/admin/settings">
              <Settings2 size={16} strokeWidth={1.5} className="shrink-0" />
              {t("settings")}
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
}
