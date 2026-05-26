import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { getCurrentUser } from "@/lib/server-auth";
import { jsonSafe } from "@/lib/json";
import { PageHeader } from "@/components/ui/page-header";
import {
  UserManagementPanel,
  type AllianceMemberOption,
  type ManagedUser,
  type UserAuditEntry,
  type UserSessionSummary,
} from "@/components/admin/UserManagementPanel";

type Props = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const t = await getTranslations("phase2.users");
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") notFound();

  const { id } = await params;
  const [user, members, sessions, auditEntries, submittedCount, reviewedCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { allianceMember: { select: { id: true, username: true } } },
    }),
    prisma.allianceMember.findMany({
      where: {
        OR: [
          { user: null },
          { user: { id } },
        ],
      },
      select: {
        id: true,
        username: true,
        user: { select: { id: true, username: true, name: true } },
      },
      orderBy: { username: "asc" },
    }),
    prisma.session.findMany({
      where: { userId: id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "user", targetId: id },
      include: { actor: { select: { id: true, username: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.pendingChange.count({ where: { submitterId: id } }),
    prisma.pendingChange.count({ where: { reviewerId: id } }),
  ]);

  if (!user) notFound();

  return (
    <div className="space-y-4">
      <PageHeader
        title={user.username ?? user.name}
        subtitle={t("detailSubtitle")}
        backHref="/admin/users"
      />
      <UserManagementPanel
        user={jsonSafe(user) as ManagedUser}
        currentUserId={currentUser.id}
        members={jsonSafe(members) as AllianceMemberOption[]}
        sessions={jsonSafe(sessions) as UserSessionSummary[]}
        auditEntries={jsonSafe(auditEntries) as UserAuditEntry[]}
        submittedCount={submittedCount}
        reviewedCount={reviewedCount}
      />
    </div>
  );
}
