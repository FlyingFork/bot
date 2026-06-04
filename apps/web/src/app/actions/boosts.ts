"use server";

import { prisma, BoostType } from "@tiles-survive/database";
import { getCurrentUser, requireUser, requireAdmin } from "@/lib/server-auth";
import { revalidatePath } from "next/cache";
import { notifyUser } from "@/app/services/notifications";

// Duration converter utility
function toSeconds(days: number, hours: number, minutes: number): number {
  return (days * 24 * 3600) + (hours * 3600) + (minutes * 60);
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Завершено";
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0 || days > 0) parts.push(`${hours}ч`);
  parts.push(`${minutes}м`);

  return parts.join(" ");
}

/**
 * Submits a new boost task for the current logged-in user.
 */
export async function createBoostTask(
  type: BoostType,
  days: number,
  hours: number,
  minutes: number
) {
  const user = await requireUser();

  if (!user.allianceMemberId) {
    throw new Error("Ваш аккаунт не привязан к игровому профилю альянса. Пожалуйста, обратитесь к R4/R5.");
  }

  const durationSeconds = toSeconds(days, hours, minutes);
  if (durationSeconds <= 0) {
    throw new Error("Длительность задачи должна быть больше нуля.");
  }

  // 1. Mark previous active tasks of this type for this member as completed (superseded)
  await prisma.boostTask.updateMany({
    where: {
      memberId: user.allianceMemberId,
      type,
      completedAt: null,
    },
    data: {
      completedAt: new Date(),
    },
  });

  // 2. Create the new task
  const task = await prisma.boostTask.create({
    data: {
      memberId: user.allianceMemberId,
      type,
      totalDurationSeconds: BigInt(durationSeconds),
      boostSecondsApplied: BigInt(0),
      startedAt: new Date(),
    },
  });

  revalidatePath("/seasons/boosts");
  return { success: true, taskId: task.id };
}

/**
 * Cancels an active boost task.
 * Can be called by the task owner or R4+ leadership.
 */
export async function cancelBoostTask(taskId: string) {
  const user = await requireUser();

  const task = await prisma.boostTask.findUnique({
    where: { id: taskId },
    include: { member: true },
  });

  if (!task) {
    throw new Error("Задача не найдена.");
  }

  const isOwner = task.memberId === user.allianceMemberId;
  const isR4Plus = user.role === "admin" || ["r4", "r5"].includes(user.role || "");

  if (!isOwner && !isR4Plus) {
    throw new Error("У вас нет прав для отмены этой задачи.");
  }

  await prisma.boostTask.update({
    where: { id: taskId },
    data: { completedAt: new Date() },
  });

  revalidatePath("/seasons/boosts");
  return { success: true };
}

/**
 * Resets/clears the active cooldown for a specific alliance member and boost type (Admin only).
 */
export async function resetMemberCooldown(memberId: string, type: BoostType) {
  await requireAdmin();

  const member = await prisma.allianceMember.findUnique({
    where: { id: memberId },
    include: { user: true },
  });

  if (!member?.user) {
    throw new Error("Участник не привязан к пользователю платформы.");
  }

  // Clear cooldown by setting endsAt to now
  await prisma.boostAction.updateMany({
    where: {
      appliedById: member.user.id,
      cooldownEndsAt: { gt: new Date() },
      OR: [
        { task: { type } },
        { type }
      ]
    },
    data: {
      cooldownEndsAt: new Date(),
    },
  });

  // Notify the user about their cooldown reset
  const typeLabel = type === "CONSTRUCTION" ? "Строительство" : "Исследования";
  await notifyUser(
    member.user.id,
    `⚡️ Администратор сбросил ваш кулдаун на <b>${typeLabel}</b>. Ваш навык снова готов к использованию!`
  ).catch((err) => console.error("Failed to notify user on reset cooldown:", err));

  revalidatePath("/seasons/boosts");
  return { success: true };
}

/**
 * Applies a percentage boost (5%, 10%, 15%) to an active task.
 * Registers a 2-day cooldown for the user applying the boost for this specific type.
 * Also reduces the applier's own active task of the same type by the same percentage (mirror-boost).
 */
export async function applyBoost(taskId: string, percentage: number) {
  const user = await requireUser();

  if (![5, 10, 15].includes(percentage)) {
    throw new Error("Недопустимый процент буста. Разрешено только 5%, 10% или 15%.");
  }

  // 1. Retrieve the target task
  const task = await prisma.boostTask.findUnique({
    where: { id: taskId },
    include: { member: { include: { user: true } } },
  });

  if (!task || task.completedAt) {
    throw new Error("Задача не найдена или уже завершена.");
  }

  // 2. Prevent self-boosting
  if (task.memberId === user.allianceMemberId) {
    throw new Error("Вы не можете применить буст на свою собственную задачу.");
  }

  // 3. Check if the user is currently on cooldown for this specific boost type
  const activeCooldown = await prisma.boostAction.findFirst({
    where: {
      appliedById: user.id,
      cooldownEndsAt: { gt: new Date() },
      OR: [
        { task: { type: task.type } },
        { type: task.type }
      ]
    },
    orderBy: { cooldownEndsAt: "desc" },
  });

  if (activeCooldown) {
    const hoursLeft = Math.ceil((activeCooldown.cooldownEndsAt.getTime() - Date.now()) / (3600 * 1000));
    throw new Error(`Ваш навык буста для этого типа задач находится в кулдауне. Осталось примерно ${hoursLeft} ч.`);
  }

  // 4. Calculate target task remaining time
  const now = Date.now();
  const elapsedSeconds = BigInt(Math.floor((now - task.startedAt.getTime()) / 1000));
  const remainingSeconds = task.totalDurationSeconds - elapsedSeconds - task.boostSecondsApplied;

  if (remainingSeconds <= BigInt(0)) {
    // Clean up task if expired
    await prisma.boostTask.update({
      where: { id: taskId },
      data: { completedAt: new Date() },
    });
    throw new Error("Время задачи уже истекло.");
  }

  // 5. Enforce minimum duration limit (in days) configured by admin
  const settings = (await prisma.allianceSettings.findUnique({
    where: { id: "primary" },
  })) || { boostMinDaysConstruction: 0, boostMinDaysResearch: 0, boostCooldownHours: 48 };

  const cooldownHours = settings.boostCooldownHours ?? 48;

  const minDaysLimit = task.type === "CONSTRUCTION"
    ? (settings.boostMinDaysConstruction ?? 0)
    : (settings.boostMinDaysResearch ?? 0);

  const minSecondsLimit = BigInt(minDaysLimit * 24 * 3600);

  if (remainingSeconds < minSecondsLimit) {
    throw new Error(
      `Нельзя применить буст. Для задач типа ${
        task.type === "CONSTRUCTION" ? "Строительство" : "Исследование"
      } минимальное оставшееся время должно быть не менее ${minDaysLimit} дней.`
    );
  }

  // 6. Calculate reduction in seconds for target task
  const reduction = (remainingSeconds * BigInt(percentage)) / BigInt(100);
  const newRemaining = remainingSeconds - reduction;
  const isCompleted = newRemaining <= BigInt(0);

  // 7. Mirror-boost check: check if the applier has an active task of the same type
  let mirrorTask = null;
  let mirrorReduction = BigInt(0);
  let mirrorCompleted = false;

  if (user.allianceMemberId) {
    mirrorTask = await prisma.boostTask.findFirst({
      where: {
        memberId: user.allianceMemberId,
        type: task.type,
        completedAt: null,
      },
    });

    if (mirrorTask) {
      const mirrorElapsed = BigInt(Math.floor((now - mirrorTask.startedAt.getTime()) / 1000));
      const mirrorRemaining = mirrorTask.totalDurationSeconds - mirrorElapsed - mirrorTask.boostSecondsApplied;

      if (mirrorRemaining > BigInt(0)) {
        mirrorReduction = (mirrorRemaining * BigInt(percentage)) / BigInt(100);
        mirrorCompleted = (mirrorRemaining - mirrorReduction) <= BigInt(0);
      }
    }
  }

  // 8. Apply everything in a transaction
  const cooldownEndsAt = new Date(Date.now() + cooldownHours * 3600 * 1000);

  await prisma.$transaction(async (tx) => {
    // Create the boost action
    await tx.boostAction.create({
      data: {
        taskId,
        appliedById: user.id,
        boostPercentage: percentage,
        secondsReduced: reduction,
        appliedAt: new Date(),
        cooldownEndsAt,
      },
    });

    // Update target task
    await tx.boostTask.update({
      where: { id: taskId },
      data: {
        boostSecondsApplied: { increment: reduction },
        completedAt: isCompleted ? new Date() : null,
      },
    });

    // Mirror-boost applier's own active task if exists
    if (mirrorTask && mirrorReduction > BigInt(0)) {
      await tx.boostTask.update({
        where: { id: mirrorTask.id },
        data: {
          boostSecondsApplied: { increment: mirrorReduction },
          completedAt: mirrorCompleted ? new Date() : null,
        },
      });
    }
  });

  // Notify the task owner about the applied boost
  if (task.member.user) {
    const applierName = user.displayUsername || user.username || user.name || "Участник";
    const taskTypeLabel = task.type === "CONSTRUCTION" ? "Строительство" : "Исследования";
    const formattedRemaining = formatDuration(Number(newRemaining));
    await notifyUser(
      task.member.user.id,
      `🚀 Игрок <b>${applierName}</b> применил к вашей задаче по бусту (<b>${taskTypeLabel}</b>) ускорение <b>+${percentage}%</b>!<br/>Оставшееся время задачи: <b>${formattedRemaining}</b>.`
    ).catch((err) => console.error("Failed to notify user on apply boost:", err));
  }

  revalidatePath("/seasons/boosts");
  return { success: true };
}

/**
 * Updates prioritization and duration settings (Admin only).
 */
export async function updateBoostSettings(
  mode: "TIME" | "POWER" | "COMBINED",
  weightPower: number = 0.5,
  weightTime: number = 0.5,
  minDaysConstruction: number = 0,
  minDaysResearch: number = 0,
  cooldownHours: number = 48
) {
  await requireAdmin();

  await prisma.allianceSettings.upsert({
    where: { id: "primary" },
    update: {
      boostPriorityMode: mode,
      boostWeightPower: weightPower,
      boostWeightTime: weightTime,
      boostMinDaysConstruction: minDaysConstruction,
      boostMinDaysResearch: minDaysResearch,
      boostCooldownHours: cooldownHours,
    },
    create: {
      id: "primary",
      boostPriorityMode: mode,
      boostWeightPower: weightPower,
      boostWeightTime: weightTime,
      boostMinDaysConstruction: minDaysConstruction,
      boostMinDaysResearch: minDaysResearch,
      boostCooldownHours: cooldownHours,
    },
  });

  revalidatePath("/seasons/boosts");
  return { success: true };
}

export interface BoostTaskWithCalculations {
  id: string;
  memberId: string;
  memberName: string;
  memberPower: number;
  type: BoostType;
  totalDurationSeconds: number;
  boostSecondsApplied: number;
  startedAt: Date;
  remainingSeconds: number;
  priorityScore: number;
  belowLimit: boolean;
  boosts: {
    appliedBy: string;
    boostPercentage: number;
    appliedAt: Date;
  }[];
}

/**
 * Fetch and calculate all data for the boost dashboard.
 */
export async function getBoostsData() {
  const currentUser = await getCurrentUser();
  const now = new Date();

  // 1. Fetch Settings
  const settings = (await prisma.allianceSettings.findUnique({
    where: { id: "primary" },
  })) || {
    boostPriorityMode: "TIME",
    boostWeightPower: 0.5,
    boostWeightTime: 0.5,
    boostMinDaysConstruction: 0,
    boostMinDaysResearch: 0,
    boostCooldownHours: 48,
  };

  // 2. Fetch active tasks
  const dbTasks = await prisma.boostTask.findMany({
    where: { completedAt: null },
    include: {
      member: {
        include: { user: true },
      },
      boosts: {
        include: {
          appliedBy: true,
        },
      },
    },
  });

  // 3. Calculate remaining times and clean up expired tasks
  const activeTasks: BoostTaskWithCalculations[] = [];
  const minSecondsConstruction = BigInt((settings.boostMinDaysConstruction ?? 0) * 24 * 3600);
  const minSecondsResearch = BigInt((settings.boostMinDaysResearch ?? 0) * 24 * 3600);

  for (const t of dbTasks) {
    const elapsedSeconds = BigInt(Math.floor((now.getTime() - t.startedAt.getTime()) / 1000));
    const remainingSeconds = t.totalDurationSeconds - elapsedSeconds - t.boostSecondsApplied;

    if (remainingSeconds <= BigInt(0)) {
      // Mark as completed in background/async
      await prisma.boostTask.update({
        where: { id: t.id },
        data: { completedAt: now },
      });
      continue;
    }

    const limitSeconds = t.type === "CONSTRUCTION" ? minSecondsConstruction : minSecondsResearch;
    const belowLimit = remainingSeconds < limitSeconds;

    activeTasks.push({
      id: t.id,
      memberId: t.memberId,
      memberName: t.member.username,
      memberPower: Number(t.member.currentPower ?? BigInt(0)),
      type: t.type,
      totalDurationSeconds: Number(t.totalDurationSeconds),
      boostSecondsApplied: Number(t.boostSecondsApplied),
      startedAt: t.startedAt,
      remainingSeconds: Number(remainingSeconds),
      priorityScore: 0, // Calculated next
      belowLimit,
      boosts: t.boosts.map((b) => ({
        appliedBy: b.appliedBy.name || b.appliedBy.username || "Игрок",
        boostPercentage: b.boostPercentage,
        appliedAt: b.appliedAt,
      })),
    });
  }

  // 4. Calculate prioritization scores
  const maxRemaining = Math.max(...activeTasks.map((t) => t.remainingSeconds), 1);
  const maxPower = Math.max(...activeTasks.map((t) => t.memberPower), 1);

  activeTasks.forEach((t) => {
    if (settings.boostPriorityMode === "TIME") {
      t.priorityScore = t.remainingSeconds;
    } else if (settings.boostPriorityMode === "POWER") {
      t.priorityScore = t.memberPower;
    } else {
      // COMBINED
      const normTime = t.remainingSeconds / maxRemaining;
      const normPower = t.memberPower / maxPower;
      t.priorityScore =
        (settings.boostWeightTime ?? 0.5) * normTime + (settings.boostWeightPower ?? 0.5) * normPower;
    }
  });

  // Split and Sort Queues
  const constructionQueue = activeTasks
    .filter((t) => t.type === "CONSTRUCTION")
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const researchQueue = activeTasks
    .filter((t) => t.type === "RESEARCH")
    .sort((a, b) => b.priorityScore - a.priorityScore);

  // Recommended targets cannot be below limit! Let's find first that is not below limit.
  const recommendedConstruction = constructionQueue.find(t => !t.belowLimit) || null;
  const recommendedResearch = researchQueue.find(t => !t.belowLimit) || null;

  // 5. Fetch cooldown status for all users with alliance members
  const dbMembers = await prisma.allianceMember.findMany({
    where: { active: true },
    include: {
      user: {
        include: {
          boostsApplied: {
            include: {
              task: true,
            },
            orderBy: { cooldownEndsAt: "desc" },
          },
        },
      },
    },
    orderBy: { username: "asc" },
  });

  const membersStatus = dbMembers.map((m) => {
    const userProfile = m.user;
    const boosts = userProfile?.boostsApplied || [];

    // Find last construction boost cooldown
    const lastConstBoost = boosts.find((b) => b.task?.type === "CONSTRUCTION" || b.type === "CONSTRUCTION") || null;
    const isConstCooldown = lastConstBoost ? lastConstBoost.cooldownEndsAt.getTime() > now.getTime() : false;
    const constCooldownRemainingSeconds = lastConstBoost
      ? Math.max(0, Math.floor((lastConstBoost.cooldownEndsAt.getTime() - now.getTime()) / 1000))
      : 0;

    // Find last research boost cooldown
    const lastResBoost = boosts.find((b) => b.task?.type === "RESEARCH" || b.type === "RESEARCH") || null;
    const isResCooldown = lastResBoost ? lastResBoost.cooldownEndsAt.getTime() > now.getTime() : false;
    const resCooldownRemainingSeconds = lastResBoost
      ? Math.max(0, Math.floor((lastResBoost.cooldownEndsAt.getTime() - now.getTime()) / 1000))
      : 0;

    return {
      memberId: m.id,
      username: m.username,
      power: Number(m.currentPower ?? BigInt(0)),
      userId: userProfile?.id || null,
      isConstCooldown,
      constCooldownRemainingSeconds,
      isResCooldown,
      resCooldownRemainingSeconds,
    };
  });

  // Get current user cooldown check
  let currentUserConstCooldown = false;
  let currentUserConstCooldownSeconds = 0;
  let currentUserResCooldown = false;
  let currentUserResCooldownSeconds = 0;

  if (currentUser) {
    const constCd = await prisma.boostAction.findFirst({
      where: {
        appliedById: currentUser.id,
        cooldownEndsAt: { gt: now },
        OR: [
          { task: { type: "CONSTRUCTION" } },
          { type: "CONSTRUCTION" }
        ]
      },
      orderBy: { cooldownEndsAt: "desc" },
    });
    if (constCd) {
      currentUserConstCooldown = true;
      currentUserConstCooldownSeconds = Math.max(0, Math.floor((constCd.cooldownEndsAt.getTime() - now.getTime()) / 1000));
    }

    const resCd = await prisma.boostAction.findFirst({
      where: {
        appliedById: currentUser.id,
        cooldownEndsAt: { gt: now },
        OR: [
          { task: { type: "RESEARCH" } },
          { type: "RESEARCH" }
        ]
      },
      orderBy: { cooldownEndsAt: "desc" },
    });
    if (resCd) {
      currentUserResCooldown = true;
      currentUserResCooldownSeconds = Math.max(0, Math.floor((resCd.cooldownEndsAt.getTime() - now.getTime()) / 1000));
    }
  }

  return {
    constructionQueue,
    researchQueue,
    recommendedConstruction,
    recommendedResearch,
    membersStatus,
    settings: {
      boostPriorityMode: settings.boostPriorityMode as "TIME" | "POWER" | "COMBINED",
      boostWeightPower: settings.boostWeightPower,
      boostWeightTime: settings.boostWeightTime,
      boostMinDaysConstruction: settings.boostMinDaysConstruction ?? 0,
      boostMinDaysResearch: settings.boostMinDaysResearch ?? 0,
      boostCooldownHours: settings.boostCooldownHours ?? 48,
    },
    currentUserConstCooldown,
    currentUserConstCooldownSeconds,
    currentUserResCooldown,
    currentUserResCooldownSeconds,
    currentUserAllianceMemberId: currentUser?.allianceMemberId || null,
  };
}

/**
 * Manually synchronizes/sets the current user's cooldown for a specific boost type.
 */
export async function syncOwnCooldown(type: BoostType, hours: number, minutes: number) {
  const user = await requireUser();

  if (hours < 0 || minutes < 0) {
    throw new Error("Укажите корректное время кулдауна.");
  }

  // 1. Expire all existing active cooldowns of this type for the user
  await prisma.boostAction.updateMany({
    where: {
      appliedById: user.id,
      cooldownEndsAt: { gt: new Date() },
      OR: [
        { task: { type } },
        { type }
      ]
    },
    data: {
      cooldownEndsAt: new Date(),
    },
  });

  // 2. If the user specified a positive time, create a new sync entry
  if (hours > 0 || minutes > 0) {
    const cooldownDurationMs = (hours * 3600 + minutes * 60) * 1000;
    const cooldownEndsAt = new Date(Date.now() + cooldownDurationMs);

    await prisma.boostAction.create({
      data: {
        taskId: null,
        type,
        appliedById: user.id,
        boostPercentage: 0,
        secondsReduced: BigInt(0),
        cooldownEndsAt,
        appliedAt: new Date(),
      },
    });
  }

  revalidatePath("/seasons/boosts");
  return { success: true };
}
