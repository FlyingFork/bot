"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AssignmentConfig = { objectiveId: string; count: number };

export function useAssignments(planId: string) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function assign(objectiveId: string, participantId: string) {
    setIsPending(true);
    try {
      await fetch(`/api/admin/raid-plans/${planId}/objectives/${objectiveId}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function unassign(objectiveId: string, participantId: string) {
    setIsPending(true);
    try {
      await fetch(`/api/admin/raid-plans/${planId}/objectives/${objectiveId}/assign/${participantId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function autoAssign(assignments: AssignmentConfig[]) {
    setIsPending(true);
    try {
      await fetch(`/api/admin/raid-plans/${planId}/auto-assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return { assign, unassign, autoAssign, isPending };
}
