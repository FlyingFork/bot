"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";

const SEGMENT_KEYS: Record<string, string> = {
  dashboard: "dashboard",
  members: "members",
  stats: "stats",
  leaderboards: "leaderboards",
  seasons: "seasons",
  upload: "upload",
  notifications: "notifications",
  profile: "profile",
  "alliance-duel": "allianceDuel",
  "reservoir-raid": "reservoirRaid",
  admin: "admin",
  verifications: "verifications",
  "upload-requests": "uploadRequests",
  "audit-log": "auditLog",
  settings: "settings",
  events: "events",
};

interface NavBreadcrumbProps {
  allianceName: string;
}

export function NavBreadcrumb({ allianceName }: NavBreadcrumbProps) {
  const pathname = usePathname();
  const t = useTranslations("phase2.nav");

  const segments = pathname.split("/").filter(Boolean);

  const labeled: string[] = [];
  for (const seg of segments) {
    const key = SEGMENT_KEYS[seg];
    if (key) {
      labeled.push(t(key as Parameters<typeof t>[0]));
    }
  }

  if (labeled.length === 0) {
    return (
      <span className="text-[13px] font-medium text-muted hidden sm:block">
        {allianceName || "Tiles Survive"}
      </span>
    );
  }

  const visible = labeled.slice(-2);

  return (
    <nav className="hidden sm:flex items-center gap-1 text-[13px]" aria-label="Breadcrumb">
      <span className="text-muted font-medium">{allianceName || "Tiles Survive"}</span>
      {visible.map((label, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={12} strokeWidth={1.5} className="text-dim shrink-0" />
          <span className={i === visible.length - 1 ? "text-text font-medium" : "text-muted"}>
            {label}
          </span>
        </span>
      ))}
    </nav>
  );
}
