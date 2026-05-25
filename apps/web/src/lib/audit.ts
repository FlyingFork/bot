import { prisma } from "@tiles-survive/database";

type AuditClient = Pick<typeof prisma, "auditLog">;

export async function createAuditLog(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  before?: object,
  after?: object,
  client: AuditClient = prisma,
) {
  await client.auditLog.create({
    data: { actorId, action, targetId: entityId, entityType, before, after },
  });
}
