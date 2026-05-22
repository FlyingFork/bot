import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

export const prisma = new PrismaClient({ adapter });

export type {
  Language,
  GroupChannel,
  TranslationGroup,
  GuildSettings,
  ManagedWebhook,
  MessageMap,
  ThreadMap,
  ReactionRoleMessage,
  ReactionRoleAssignment,
  RoleAssignmentAudit,
  TranslationStat,
  TranslationApiEvent,
  ReactionRoleStatus,
  AllianceEventImport,
  AllianceEventSnapshot,
  AllianceEventType,
  AllianceMember,
  AllianceRank,
  AllianceRosterImport,
  AllianceRosterSnapshot,
  AllianceSettings,
  ReservoirRaidAssignment,
  ReservoirRaidContactType,
  ReservoirRaidParticipant,
  ReservoirRaidPlan,
  ReservoirRaidSquadPower,
  user,
  session,
  account,
  AuditLog,
} from "./generated/prisma/client";
