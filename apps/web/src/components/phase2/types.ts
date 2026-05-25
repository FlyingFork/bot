export type LinkedUserSummary = {
  id: string;
  username: string | null;
  name: string;
  role: string | null;
  platformStatus: string;
  banned: boolean | null;
};

export type MemberSummary = {
  id: string;
  username: string;
  active: boolean;
  currentRank: string | null;
  currentPower: string | null;
  currentPowerPlantLevel: number | null;
  lastRosterImportedAt: string | null;
  memberStatus: string;
  isTempAway: boolean;
  tempAwayAllianceTag: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: LinkedUserSummary | null;
};

export type PendingUser = {
  id: string;
  username: string | null;
  name: string;
  role: string | null;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  targetId: string;
  entityType: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  actor: { id: string; username: string | null; name: string };
};

export type AllianceSettingsData = {
  id: string;
  name: string;
  tag: string;
  staleThresholdSoloPower: number;
  staleThresholdBattleVanguard: number;
  staleThresholdHeadquarters: number;
  staleThresholdHero: number;
  staleThresholdHeroPower: number;
  staleThresholdBehemoth: number;
  staleThresholdExploration: number;
  staleThresholdCollection: number;
  staleThresholdAlliancePlayerList: number;
  contributionWeightPowerGrowth: number;
  contributionWeightDuelParticipation: number;
  contributionWeightRaidParticipation: number;
};

