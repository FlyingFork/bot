import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { MembersTable } from "@/components/alliance/MembersTable";
import { RosterImportPanel } from "@/components/alliance/ImportPanels";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { renderAlliancePrompt } from "@/lib/alliance-prompts";

export const dynamic = "force-dynamic";

export default async function AllianceMembersPage() {
  const t = await getTranslations("alliance.members");
  const [members, settings] = await Promise.all([
    prisma.allianceMember.findMany({
      where: { active: true },
      orderBy: [{ currentPower: "desc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        active: true,
        currentRank: true,
        currentPower: true,
        currentPowerPlantLevel: true,
        lastRosterImportedAt: true,
      },
    }),
    prisma.allianceSettings.findUnique({ where: { id: "primary" } }),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/dashboard/members/archive"
            className={buttonVariants({ variant: "outline" })}
          >
            {t("archive")}
          </Link>
        }
      />
      <RosterImportPanel
        prompt={renderAlliancePrompt("allianceMembers", settings?.tag)}
      />
      <MembersTable
        exportName="alliance-members"
        members={members.map((member) => ({
          ...member,
          currentRank: member.currentRank,
          currentPower: member.currentPower?.toString() ?? null,
          lastRosterImportedAt: member.lastRosterImportedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
