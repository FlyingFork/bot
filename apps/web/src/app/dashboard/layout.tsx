import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { LayoutDashboard, Users, Swords, BookOpen, Settings2, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { NavLink } from "@/components/NavLink";
import { MobileNav } from "@/components/MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("nav");

  const session = await auth.api.getSession({ headers: await headers() });
  const username = session?.user?.username ?? session?.user?.name ?? "";
  const isAdmin = session?.user?.role === "admin";

  const navContent = (
    <>
      <p className="text-[11px] font-bold tracking-widest uppercase text-text-muted px-3.5 pt-3 pb-1">
        {t("navigation")}
      </p>
      <NavLink href="/dashboard" exact>
        <LayoutDashboard size={16} className="shrink-0 text-sky-400" />
        {t("dashboard")}
      </NavLink>
      <NavLink href="/dashboard/members">
        <Users size={16} className="shrink-0 text-emerald-400" />
        {t("allianceMembers")}
      </NavLink>
      <NavLink href="/dashboard/events">
        <Swords size={16} className="shrink-0 text-amber-400" />
        {t("events")}
      </NavLink>
      <NavLink href="/dashboard/guides">
        <BookOpen size={16} className="shrink-0 text-violet-400" />
        {t("guides")}
      </NavLink>
      <NavLink href="/dashboard/alliance-settings">
        <Settings2 size={16} className="shrink-0 text-slate-400" />
        {t("allianceSettings")}
      </NavLink>

      {isAdmin && (
        <>
          <NavLink href="/admin">
            <ShieldCheck size={16} className="shrink-0 text-rose-400" />
            {t("admin")}
          </NavLink>
        </>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-void">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 border-r border-border-dim bg-base flex-col bg-grid-pattern">
        <div className="flex items-center gap-2 px-3.5 py-4 border-b border-border-dim">
          <div className="w-7 h-7 bg-cn-cyan rounded flex items-center justify-center text-void font-extrabold text-[10px] shrink-0">
            TS
          </div>
          <span className="text-sm font-extrabold tracking-tight text-text-primary">
            Tiles Survive
          </span>
        </div>
        <nav className="flex flex-col flex-1 pt-2 pb-4">{navContent}</nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border-dim bg-base px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger + overlay */}
            <MobileNav navContent={navContent} />
            <span className="text-sm text-text-secondary">{username}</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <SignOutButton label={t("signOut")} />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-void">
          {children}
        </main>
      </div>
    </div>
  );
}
