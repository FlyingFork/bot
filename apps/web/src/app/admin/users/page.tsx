import { getTranslations } from "next-intl/server";
import { prisma } from "@tiles-survive/database";
import { UsersTable } from "./UsersTable";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getTranslations("admin.users");
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.user.count(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const usersData = users.map((u) => ({
    id: u.id,
    username: u.username ?? u.name,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    lastSignIn: u.sessions[0]?.createdAt.toISOString() ?? null,
    role: u.role ?? "user",
    emailVerified: u.emailVerified,
    banned: u.banned ?? null,
    banReason: u.banReason ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <PageHeader title={t("title")} />
      <UsersTable
        users={usersData}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
