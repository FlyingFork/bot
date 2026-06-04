import "dotenv/config";
import { randomBytes, scrypt } from "node:crypto";
import { prisma } from "./index";
import type { AllianceRank, MemberStatus } from "./generated/prisma";

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const doReset = args.includes("--reset");
const scenarioIdx = args.indexOf("--scenario");
const scenario = scenarioIdx !== -1 ? args[scenarioIdx + 1] : undefined;

const VALID_SCENARIOS = ["members", "raid", "duel", "leaderboard"] as const;
if (scenario && !VALID_SCENARIOS.includes(scenario as never)) {
  console.error(`Unknown scenario "${scenario}". Valid: ${VALID_SCENARIOS.join(", ")}`);
  process.exit(1);
}

// ─── Password hashing ────────────────────────────────────────────────────────
// Matches Better Auth's scrypt format exactly: `${salt}:${key.hex}`
// Parameters mirror @better-auth/utils/password.node.mjs

const SCRYPT = { N: 16384, r: 16, p: 1, dkLen: 64 } as const;

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      SCRYPT.dkLen,
      {
        N: SCRYPT.N,
        r: SCRYPT.r,
        p: SCRYPT.p,
        maxmem: 128 * SCRYPT.N * SCRYPT.r * 2,
      },
      (err, key) => (err ? reject(err) : resolve(`${salt}:${key.toString("hex")}`))
    );
  });
}

// ─── Member definitions ──────────────────────────────────────────────────────

type MemberDef = {
  id: string;
  username: string;
  rank: AllianceRank;
  power: bigint;
  memberStatus?: MemberStatus;
};

const MEMBERS: MemberDef[] = [
  { id: "seed-member-01", username: "ShadowBlade",  rank: "R5", power: 15_000_000n },
  { id: "seed-member-02", username: "Волков",        rank: "R5", power: 14_500_000n },
  { id: "seed-member-03", username: "IronWolf",      rank: "R4", power: 12_000_000n },
  { id: "seed-member-04", username: "Медведев",      rank: "R4", power: 11_500_000n },
  { id: "seed-member-05", username: "StormBreaker",  rank: "R4", power: 11_000_000n },
  { id: "seed-member-06", username: "Соколов",       rank: "R3", power:  9_500_000n },
  { id: "seed-member-07", username: "CrimsonKnight", rank: "R3", power:  9_000_000n },
  { id: "seed-member-08", username: "Орлов",         rank: "R3", power:  8_500_000n },
  { id: "seed-member-09", username: "NightHunter",   rank: "R3", power:  8_000_000n },
  { id: "seed-member-10", username: "Зайцев",        rank: "R3", power:  7_500_000n },
  { id: "seed-member-11", username: "SilverArrow",   rank: "R2", power:  6_500_000n },
  { id: "seed-member-12", username: "Львов",         rank: "R2", power:  6_000_000n },
  { id: "seed-member-13", username: "ThunderFist",   rank: "R2", power:  5_500_000n },
  { id: "seed-member-14", username: "Козлов",        rank: "R2", power:  5_000_000n },
  { id: "seed-member-15", username: "GoldRush",      rank: "R2", power:  4_500_000n },
  { id: "seed-member-16", username: "Новиков",       rank: "R1", power:  3_500_000n },
  { id: "seed-member-17", username: "StarForge",     rank: "R1", power:  3_000_000n },
  { id: "seed-member-18", username: "Морозов",       rank: "R1", power:  2_500_000n },
  { id: "seed-member-19", username: "ViperStrike",   rank: "R1", power:  2_000_000n, memberStatus: "TEMP_AWAY" },
  { id: "seed-member-20", username: "Громов",        rank: "R1", power:  1_500_000n, memberStatus: "TEMP_AWAY" },
];

// ─── Reset ───────────────────────────────────────────────────────────────────

async function reset() {
  console.log("Resetting platform data...");
  // Order: most-dependent tables first, then their parents
  await prisma.$transaction([
    prisma.reservoirRaidScoreHistory.deleteMany(),
    prisma.reservoirRaidAssignment.deleteMany(),
    prisma.reservoirRaidSquadPower.deleteMany(),
    prisma.reservoirRaidParticipant.deleteMany(),
    prisma.reservoirRaidObjective.deleteMany(),
    prisma.reservoirRaidPlan.deleteMany(),
    prisma.allianceDuelScore.deleteMany(),
    prisma.allianceDuelDay.deleteMany(),
    prisma.allianceDuelInstance.deleteMany(),
    prisma.leaderboardEntry.deleteMany(),
    prisma.leaderboardSnapshot.deleteMany(),
    prisma.allianceEventSnapshot.deleteMany(),
    prisma.allianceEventImport.deleteMany(),
    prisma.allianceRosterSnapshot.deleteMany(),
    prisma.allianceRosterImport.deleteMany(),
    prisma.pendingChange.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.memberNameHistory.deleteMany(),
    prisma.user.deleteMany(),
    prisma.allianceMember.deleteMany(),
    prisma.season.deleteMany(),
  ]);
  console.log("Reset complete.");
}

// ─── Core ────────────────────────────────────────────────────────────────────

async function seedCore() {
  await prisma.allianceSettings.upsert({
    where: { id: "primary" },
    update: { name: "Test Alliance", tag: "[TEST]" },
    create: { id: "primary", name: "Test Alliance", tag: "[TEST]" },
  });

  await prisma.season.upsert({
    where: { id: "seed-season-01" },
    update: {},
    create: {
      id: "seed-season-01",
      name: "Season 1",
      startDate: new Date(Date.now() - 90 * 86_400_000),
      isActive: true,
    },
  });

  console.log("Seeded AllianceSettings + Season");
}

// ─── Members ─────────────────────────────────────────────────────────────────

async function seedMembers() {
  for (const m of MEMBERS) {
    await prisma.allianceMember.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        username: m.username,
        currentRank: m.rank,
        currentPower: m.power,
        currentPowerPlantLevel: 10,
        memberStatus: m.memberStatus ?? "ACTIVE",
        isTempAway: m.memberStatus === "TEMP_AWAY",
        joinedAt: new Date(Date.now() - 180 * 86_400_000),
      },
    });
  }

  // Roster import (actorId is an unlinked string field — no FK)
  await prisma.allianceRosterImport.upsert({
    where: { id: "seed-roster-import-01" },
    update: {},
    create: {
      id: "seed-roster-import-01",
      actorId: "seed-user-admin",
      snapshots: {
        create: MEMBERS.map((m) => ({
          memberId: m.id,
          power: m.power,
          powerPlantLevel: 10,
          rank: m.rank,
        })),
      },
    },
  });

  console.log("Seeded 20 members + roster import");
}

// ─── Raid ────────────────────────────────────────────────────────────────────

const RAID_OBJECTIVES = [
  { key: "A1", tier: 3, waterRate: 500, isAssignable: true,  mapX: 0.2, mapY: 0.3 },
  { key: "A2", tier: 3, waterRate: 450, isAssignable: true,  mapX: 0.3, mapY: 0.3 },
  { key: "B1", tier: 2, waterRate: 300, isAssignable: true,  mapX: 0.5, mapY: 0.5 },
  { key: "B2", tier: 2, waterRate: 280, isAssignable: true,  mapX: 0.6, mapY: 0.5 },
  { key: "C1", tier: 1, waterRate: 150, isAssignable: true,  mapX: 0.8, mapY: 0.7 },
  { key: "C2", tier: 1, waterRate: 120, isAssignable: false, mapX: 0.9, mapY: 0.7 },
] as const;

async function seedPlan(
  planId: string,
  publicToken: string,
  daysOffset: number,
  ended: boolean
) {
  const raidMs = Date.now() + daysOffset * 86_400_000;

  const plan = await prisma.reservoirRaidPlan.upsert({
    where: { id: planId },
    update: {},
    create: {
      id: planId,
      raidDate: new Date(raidMs),
      startsAt: new Date(raidMs + 10 * 3_600_000),
      publicToken,
      registrationOpen: !ended,
      status: ended ? "ENDED" : "ACTIVE",
      createdById: "seed-user-admin",
    },
  });

  const existingObjs = await prisma.reservoirRaidObjective.count({
    where: { planId: plan.id },
  });
  if (existingObjs > 0) return;

  const objectives = await Promise.all(
    RAID_OBJECTIVES.map((o) =>
      prisma.reservoirRaidObjective.create({ data: { planId: plan.id, ...o } })
    )
  );

  const participants = await Promise.all(
    MEMBERS.slice(0, 15).map((m, i) =>
      prisma.reservoirRaidParticipant.create({
        data: {
          planId: plan.id,
          memberId: m.id,
          username: m.username,
          contactType: i % 2 === 0 ? "DISCORD" : "TELEGRAM",
          contact: i % 2 === 0 ? `@${m.username.toLowerCase()}` : `+7999${String(i).padStart(7, "0")}`,
          confirmed: ended ? true : i < 10,
          participant: i < 6,
          reservist: i >= 6 && i < 10,
          registrationStatus:
            i < 6 ? "SELECTED_PARTICIPANT" : i < 10 ? "SELECTED_RESERVIST" : "MATCHED",
          waterCollected: ended ? 300 + i * 20 : undefined,
        },
      })
    )
  );

  // Assign first 6 (assignable objectives) to first 6 participants
  for (let i = 0; i < 6; i++) {
    await prisma.reservoirRaidAssignment.create({
      data: {
        planId: plan.id,
        objectiveId: objectives[i].id,
        participantId: participants[i].id,
      },
    });
  }
}

async function seedRaid() {
  await seedPlan("seed-raid-plan-01", "seed-active-raid-tkn01", 7, false);
  await seedPlan("seed-raid-plan-02", "seed-ended-raid-tkn02", -30, true);

  // RRS score history — 3 entries per member over the past 3 months
  for (const m of MEMBERS) {
    const count = await prisma.reservoirRaidScoreHistory.count({
      where: { memberId: m.id },
    });
    if (count > 0) continue;

    const base = 100 + Math.floor(Number(m.power) / 1_000_000) * 5;
    await prisma.reservoirRaidScoreHistory.createMany({
      data: [
        { memberId: m.id, score: base + 50, recordedAt: new Date(Date.now() - 30 * 86_400_000) },
        { memberId: m.id, score: base + 25, recordedAt: new Date(Date.now() - 60 * 86_400_000) },
        { memberId: m.id, score: base,      recordedAt: new Date(Date.now() - 90 * 86_400_000) },
      ],
    });
  }

  console.log("Seeded 2 raid plans + RRS score history");
}

// ─── Duel ────────────────────────────────────────────────────────────────────

const ENEMY_NAMES = [
  "Darkblade", "Громила", "Destroyer", "Тёмный",
  "IceKing",   "Снежок",  "FireStorm", "Буря",
  "Shadow",    "Орёл",
];

async function seedDuel() {
  const now = Date.now();

  const duel = await prisma.allianceDuelInstance.upsert({
    where: { id: "seed-duel-01" },
    update: {},
    create: {
      id: "seed-duel-01",
      startDate: new Date(now - 14 * 86_400_000),
      endDate:   new Date(now -  7 * 86_400_000),
      status: "ENDED",
      opponentTag: "[RIVAL]",
      opponentName: "Rival Alliance",
      outcome: "WIN",
      createdById: "seed-user-admin",
    },
  });

  const dayCount = await prisma.allianceDuelDay.count({
    where: { instanceId: duel.id },
  });
  if (dayCount > 0) {
    console.log("Seeded duel instance (skipped days — already exist)");
    return;
  }

  const pointValues = [500, 500, 1000, 1000, 2000];

  for (let d = 0; d < 5; d++) {
    const day = await prisma.allianceDuelDay.create({
      data: {
        instanceId: duel.id,
        dayNumber: d + 1,
        date: new Date(now - (13 - d) * 86_400_000),
        pointValue: pointValues[d],
        hasData: true,
        dayOutcome: "WIN",
        allyTotalPoints:  BigInt(2500 + d * 300),
        enemyTotalPoints: BigInt(1800 + d * 200),
      },
    });

    await prisma.allianceDuelScore.createMany({
      data: MEMBERS.slice(0, 10).map((m) => ({
        dayId: day.id,
        side: "ALLY" as const,
        memberId: m.id,
        playerName: m.username,
        points: BigInt(200 + Math.floor(Math.random() * 100)),
      })),
    });

    await prisma.allianceDuelScore.createMany({
      data: ENEMY_NAMES.map((name) => ({
        dayId: day.id,
        side: "ENEMY" as const,
        memberId: null,
        playerName: name,
        points: BigInt(150 + Math.floor(Math.random() * 80)),
      })),
    });
  }

  console.log("Seeded duel instance + 5 days");
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

async function seedLeaderboard() {
  const existing = await prisma.leaderboardSnapshot.count({
    where: { changeRequestId: "seed" },
  });
  if (existing > 0) {
    console.log("Seeded leaderboard snapshots (skipped — already exist)");
    return;
  }

  const sortedMembers = [...MEMBERS].sort((a, b) => (a.power > b.power ? -1 : 1));

  for (const type of ["SOLO_POWER", "BATTLE_VANGUARD"] as const) {
    const snapshot = await prisma.leaderboardSnapshot.create({
      data: {
        type,
        capturedAt: new Date(),
        seasonId: "seed-season-01",
        changeRequestId: "seed",
      },
    });

    await prisma.leaderboardEntry.createMany({
      data: sortedMembers.map((m, i) => ({
        snapshotId: snapshot.id,
        memberId: m.id,
        rank: i + 1,
        playerName: m.username,
        data: { power: m.power.toString() },
      })),
    });
  }

  console.log("Seeded 2 leaderboard snapshots (SOLO_POWER, BATTLE_VANGUARD)");
}

// ─── Users ───────────────────────────────────────────────────────────────────

async function seedUsers() {
  const now = new Date();
  const [adminHash, user1Hash] = await Promise.all([
    hashPassword("devpassword"),
    hashPassword("devpassword"),
  ]);

  // Admin
  await prisma.user.upsert({
    where: { id: "seed-user-admin" },
    update: {},
    create: {
      id: "seed-user-admin",
      name: "Dev Admin",
      email: "admin@dev.local",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      username: "devadmin",
      role: "admin",
      platformStatus: "ACTIVE",
      language: "en",
      allianceMemberId: "seed-member-01",
    },
  });
  await prisma.account.upsert({
    where: { id: "seed-account-admin" },
    update: {},
    create: {
      id: "seed-account-admin",
      accountId: "seed-user-admin",
      providerId: "credential",
      userId: "seed-user-admin",
      password: adminHash,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Regular user (Russian language)
  await prisma.user.upsert({
    where: { id: "seed-user-01" },
    update: {},
    create: {
      id: "seed-user-01",
      name: "Test User",
      email: "user1@dev.local",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      username: "testuser1",
      platformStatus: "ACTIVE",
      language: "ru",
      allianceMemberId: "seed-member-03",
    },
  });
  await prisma.account.upsert({
    where: { id: "seed-account-01" },
    update: {},
    create: {
      id: "seed-account-01",
      accountId: "seed-user-01",
      providerId: "credential",
      userId: "seed-user-01",
      password: user1Hash,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Pending user (no member link)
  await prisma.user.upsert({
    where: { id: "seed-user-02" },
    update: {},
    create: {
      id: "seed-user-02",
      name: "Pending User",
      email: "user2@dev.local",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      username: "pendinguser2",
      platformStatus: "PENDING",
      language: "en",
    },
  });

  console.log(
    "Seeded 3 users:\n" +
    "  admin@dev.local  (admin, ACTIVE, linked to ShadowBlade)\n" +
    "  user1@dev.local  (member, ACTIVE, linked to IronWolf)\n" +
    "  user2@dev.local  (PENDING, no member link)\n" +
    "  Password for all: devpassword"
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const runAll = !scenario;

  if (doReset) await reset();

  // Core and members are always seeded (prerequisites for everything else)
  await seedCore();
  await seedMembers();

  if (runAll || scenario === "raid")        await seedRaid();
  if (runAll || scenario === "duel")        await seedDuel();
  if (runAll || scenario === "leaderboard") await seedLeaderboard();
  if (runAll)                               await seedUsers();
}

main().catch(console.error).finally(() => prisma.$disconnect());
