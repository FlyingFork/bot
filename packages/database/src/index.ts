import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

export const prisma = new PrismaClient({ adapter });

export type {
  // BOT TYPES
  Language, GroupChannel, TranslationGroup, GuildSettings, ManagedWebhook,
  MessageMap, ThreadMap, ReactionRoleMessage, ReactionRoleAssignment,
  RoleAssignmentAudit, TranslationStat, TranslationApiEvent, ReactionRoleStatus,
  // EXTENDED TYPES
  AllianceMember, AllianceRank, AllianceRosterImport, AllianceRosterSnapshot,
  AllianceEventImport, AllianceEventSnapshot, AllianceSettings,
  ReservoirRaidAssignment, ReservoirRaidContactType, ReservoirRaidParticipant,
  ReservoirRaidPlan, ReservoirRaidSquadPower,
  user, session, account, AuditLog, PendingChange, PendingChangeStatus,
  PendingChangeType,
  // NEW TYPES
  PlatformUserStatus, MemberStatus, LeaderboardType, NotificationType,
  EventStatus, DuelOutcome, DuelSide, RegistrationStatus,
  MemberNameHistory, LeaderboardSnapshot, LeaderboardEntry,
  Notification, Season, AllianceDuelInstance, AllianceDuelDay,
  AllianceDuelScore, ReservoirRaidObjective,
  BoostType, BoostTask, BoostAction,
} from "./generated/prisma/client";
