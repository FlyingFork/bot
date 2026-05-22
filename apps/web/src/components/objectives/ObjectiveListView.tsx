"use client";

import { RESERVOIR_RAID_OBJECTIVES } from "@/data/tilessurvive-objectives";
import type { ObjectiveId, ObjectiveMember } from "@/types/objectives";
import { ObjectiveCard } from "./ObjectiveCard";

const sortedObjectives = RESERVOIR_RAID_OBJECTIVES.slice().sort((left, right) => {
  if (left.ratePerMin === right.ratePerMin) {
    return 0;
  }

  if (left.ratePerMin === null) {
    return 1;
  }

  if (right.ratePerMin === null) {
    return -1;
  }

  return right.ratePerMin - left.ratePerMin;
});

export function ObjectiveListView({
  assignments,
  members,
  onSelect,
}: {
  assignments: Map<ObjectiveId, Set<string>>;
  members: ObjectiveMember[];
  onSelect: (objectiveId: ObjectiveId) => void;
}) {
  const membersById = new Map(members.map((member) => [member.id, member]));

  return (
    <div className="flex flex-col gap-2">
      {sortedObjectives.map((objective) => (
        <ObjectiveCard
          assignedMembers={Array.from(assignments.get(objective.id) ?? [])
            .flatMap((memberId) => {
              const member = membersById.get(memberId);
              return member ? [member] : [];
            })
            .sort((left, right) => left.username.localeCompare(right.username))}
          key={objective.id}
          objective={objective}
          onClick={() => onSelect(objective.id)}
        />
      ))}
    </div>
  );
}
