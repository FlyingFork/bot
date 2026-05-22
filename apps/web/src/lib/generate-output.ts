import { OBJECTIVE_NAMES } from "@/data/objective-names";
import { RESERVOIR_RAID_OBJECTIVES } from "@/data/tilessurvive-objectives";
import type {
  ExportFormat,
  ExportLocale,
  ObjectiveMember,
  ReservoirRaidAssignmentRow,
} from "@/types/objectives";

type OutputLabels = {
  title: string;
  player: string;
  objective: string;
  rate: string;
  empty: string;
  noRate: string;
};

const labels: Record<ExportLocale, OutputLabels> = {
  en: {
    title: "Reservoir Raid plan",
    player: "Player",
    objective: "Objective",
    rate: "Rate",
    empty: "Unassigned",
    noRate: "collector",
  },
  tr: {
    title: "Rezervuar Baskini plani",
    player: "Oyuncu",
    objective: "Hedef",
    rate: "Oran",
    empty: "Atanmadi",
    noRate: "toplayici",
  },
  ru: {
    title: "План Рейда на резервуар",
    player: "Игрок",
    objective: "Цель",
    rate: "Доход",
    empty: "Не назначено",
    noRate: "сборщики",
  },
};

function formatRate(rate: number | null, locale: ExportLocale) {
  return rate === null
    ? labels[locale].noRate
    : `+${rate}/${locale === "en" ? "min" : locale === "tr" ? "dk" : "мин"}`;
}

function outputRows(
  assignments: ReservoirRaidAssignmentRow[],
  members: ObjectiveMember[],
  locale: ExportLocale,
) {
  const memberNames = new Map(members.map((member) => [member.id, member.username]));
  const assignedByObjective = new Map<string, string[]>();

  assignments.forEach((assignment) => {
    const username = memberNames.get(assignment.participantId);

    if (!username) {
      return;
    }

    const players = assignedByObjective.get(assignment.objectiveId) ?? [];
    players.push(username);
    assignedByObjective.set(assignment.objectiveId, players);
  });

  return RESERVOIR_RAID_OBJECTIVES.map((objective) => ({
    objectiveId: objective.id,
    objective: OBJECTIVE_NAMES[objective.id][locale],
    players: (assignedByObjective.get(objective.id) ?? []).sort((left, right) =>
      left.localeCompare(right),
    ),
    rate: formatRate(objective.ratePerMin, locale),
  }));
}

function byPlayerRows(
  assignments: ReservoirRaidAssignmentRow[],
  members: ObjectiveMember[],
  locale: ExportLocale,
) {
  const objectiveNames = new Map(
    RESERVOIR_RAID_OBJECTIVES.map((objective) => [
      objective.id,
      OBJECTIVE_NAMES[objective.id][locale],
    ]),
  );
  const rows = new Map<string, string[]>();

  assignments.forEach((assignment) => {
    const objective = objectiveNames.get(assignment.objectiveId);

    if (!objective) {
      return;
    }

    const list = rows.get(assignment.participantId) ?? [];
    list.push(objective);
    rows.set(assignment.participantId, list);
  });

  return members
    .flatMap((member) => {
      const objectives = rows.get(member.id);
      return objectives?.length
        ? [{ username: member.username, objectives: objectives.sort() }]
        : [];
    })
    .sort((left, right) => left.username.localeCompare(right.username));
}

function markdownTable(rows: ReturnType<typeof outputRows>, locale: ExportLocale) {
  const copy = labels[locale];

  return [
    `| ${copy.objective} | ${copy.rate} | ${copy.player} |`,
    "| --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.objective} | ${row.rate} | ${row.players.join(", ") || copy.empty} |`,
    ),
  ].join("\n");
}

export function generateReservoirRaidOutput({
  assignments,
  format,
  locale,
  members,
}: {
  assignments: ReservoirRaidAssignmentRow[];
  format: ExportFormat;
  locale: ExportLocale;
  members: ObjectiveMember[];
}) {
  const copy = labels[locale];
  const rows = outputRows(assignments, members, locale);

  if (format === "table") {
    return `${copy.title}\n\n${markdownTable(rows, locale)}`;
  }

  if (format === "per-player") {
    const players = byPlayerRows(assignments, members, locale);

    return [
      copy.title,
      "",
      ...(players.length
        ? players.map((player) => `${player.username}: ${player.objectives.join(", ")}`)
        : [copy.empty]),
    ].join("\n");
  }

  if (format === "discord") {
    return [
      `**${copy.title}**`,
      ...rows.map(
        (row) =>
          `- **${row.objective}** (${row.rate}): ${row.players.join(", ") || `_${copy.empty}_`}`,
      ),
    ].join("\n");
  }

  return [
    copy.title,
    "",
    ...rows.map(
      (row) => `${row.objective} (${row.rate}): ${row.players.join(", ") || copy.empty}`,
    ),
  ].join("\n");
}
