"use client";

import { useCallback, useMemo, useState } from "react";
import {
  resetPlan,
  setAssignment,
  type AssignmentMutationResult,
} from "@/app/dashboard/events/reservoir-raid/actions";
import type {
  ObjectiveId,
  ReservoirRaidAssignmentRow,
  SerializedReservoirRaidPlan,
} from "@/types/objectives";

function assignmentMap(rows: ReservoirRaidAssignmentRow[]) {
  const values = new Map<ObjectiveId, Set<string>>();

  rows.forEach((row) => {
    const members = values.get(row.objectiveId) ?? new Set<string>();
    members.add(row.participantId);
    values.set(row.objectiveId, members);
  });

  return values;
}

function copyMap(values: Map<ObjectiveId, Set<string>>) {
  return new Map(
    Array.from(values.entries(), ([objectiveId, memberIds]) => [
      objectiveId,
      new Set(memberIds),
    ]),
  );
}

function toRows(values: Map<ObjectiveId, Set<string>>) {
  return Array.from(values.entries()).flatMap(([objectiveId, memberIds]) =>
    Array.from(memberIds, (participantId) => ({ objectiveId, participantId })),
  );
}

export function useObjectiveAssignments(plan: SerializedReservoirRaidPlan) {
  const [assignments, setAssignments] = useState(() => assignmentMap(plan.assignments));
  const [pendingSaves, setPendingSaves] = useState(0);
  const [lastSaved, setLastSaved] = useState(plan.updatedAt);
  const [saveError, setSaveError] = useState(false);

  const toggleAssignment = useCallback(
    async (objectiveId: ObjectiveId, memberId: string) => {
      const previousAssigned = assignments.get(objectiveId)?.has(memberId) ?? false;
      const assigned = !previousAssigned;

      setAssignments((current) => {
        const next = copyMap(current);
        const members = next.get(objectiveId) ?? new Set<string>();

        if (assigned) {
          members.add(memberId);
          next.set(objectiveId, members);
        } else {
          members.delete(memberId);

          if (members.size) {
            next.set(objectiveId, members);
          } else {
            next.delete(objectiveId);
          }
        }

        return next;
      });
      setSaveError(false);
      setPendingSaves((count) => count + 1);

      let result: AssignmentMutationResult = { ok: false };

      try {
        result = await setAssignment({
          assigned,
          participantId: memberId,
          objectiveId,
          planId: plan.id,
        });
      } catch {
        result = { ok: false };
      }

      setPendingSaves((count) => Math.max(0, count - 1));

      if (result.ok) {
        setLastSaved(result.updatedAt ?? new Date().toISOString());
        return;
      }

      setSaveError(true);
      setAssignments((current) => {
        const next = copyMap(current);
        const members = next.get(objectiveId) ?? new Set<string>();

        if (previousAssigned) {
          members.add(memberId);
          next.set(objectiveId, members);
        } else {
          members.delete(memberId);

          if (members.size) {
            next.set(objectiveId, members);
          } else {
            next.delete(objectiveId);
          }
        }

        return next;
      });
    },
    [assignments, plan.id],
  );

  const resetAssignments = useCallback(async () => {
    const previousAssignments = assignments;

    setAssignments(new Map());
    setSaveError(false);
    setPendingSaves((count) => count + 1);

    let result: AssignmentMutationResult = { ok: false };

    try {
      result = await resetPlan(plan.id);
    } catch {
      result = { ok: false };
    }

    setPendingSaves((count) => Math.max(0, count - 1));

    if (result.ok) {
      setLastSaved(result.updatedAt ?? new Date().toISOString());
      return;
    }

    setSaveError(true);
    setAssignments(previousAssignments);
  }, [assignments, plan.id]);

  const getObjectivesForMember = useCallback(
    (memberId: string) =>
      Array.from(assignments.entries()).flatMap(([objectiveId, memberIds]) =>
        memberIds.has(memberId) ? [objectiveId] : [],
      ),
    [assignments],
  );

  const getMemberLoad = useCallback(
    (memberId: string) => getObjectivesForMember(memberId).length,
    [getObjectivesForMember],
  );

  const rows = useMemo(() => toRows(assignments), [assignments]);

  return {
    assignments,
    assignmentRows: rows,
    getMemberLoad,
    getObjectivesForMember,
    lastSaved,
    saveError,
    saving: pendingSaves > 0,
    resetAssignments,
    toggleAssignment,
  };
}
