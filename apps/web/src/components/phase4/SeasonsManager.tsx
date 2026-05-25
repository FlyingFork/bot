"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarPlus, Check, Edit, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export type SeasonRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  closedAt: string | null;
  snapshotCount: number;
};

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function dateInputValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

type EditForm = {
  id: string;
  startDate: string;
  endDate: string;
};

export function SeasonsManager({ seasons }: { seasons: SeasonRow[] }) {
  const t = useTranslations("phase4.seasons");
  const common = useTranslations("phase2.common");
  const router = useRouter();
  const activeSeason = seasons.find((season) => season.isActive);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  async function createSeason() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/seasons", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, startDate }),
      });
      if (!response.ok) throw new Error(t("saveError"));
      setName("");
      setStartDate("");
      setMessage(t("created"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function closeSeason(id: string) {
    if (!window.confirm(t("closeConfirm"))) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/seasons/${id}/close`, { method: "POST" });
      if (!response.ok) throw new Error(t("closeError"));
      setMessage(t("closed"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("closeError"));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(season: SeasonRow) {
    setMessage(null);
    setError(null);
    setEditForm({
      id: season.id,
      startDate: dateInputValue(season.startDate),
      endDate: dateInputValue(season.endDate),
    });
  }

  async function saveDates() {
    if (!editForm) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/admin/seasons/${editForm.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate: editForm.startDate,
          endDate: editForm.endDate || null,
        }),
      });
      if (!response.ok) throw new Error(t("saveError"));
      setEditForm(null);
      setMessage(t("saved"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        <h2 className="text-sm font-bold text-text-primary">{t("createTitle")}</h2>
        {activeSeason ? (
          <p className="rounded-md border border-cn-warning/30 bg-cn-warning/5 p-3 text-sm text-cn-warning">
            {t("activeWarning")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("name")}
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-medium text-text-secondary">
              {t("startDate")}
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <Button onClick={createSeason} disabled={busy || !name.trim() || !startDate}>
              <CalendarPlus />
              {t("create")}
            </Button>
          </div>
        )}
        {message && <p className="text-sm text-cn-success">{message}</p>}
        {error && <p className="text-sm text-cn-danger">{error}</p>}
      </section>

      <section className="rounded-md border border-border-subtle bg-surface p-4 space-y-3">
        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {seasons.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">{t("empty")}</p>
          ) : (
            seasons.map((season) => {
              const editing = editForm?.id === season.id;
              return (
                <div key={season.id} className="rounded-md border border-border-dim bg-raised p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-text-primary">{season.name}</span>
                    <Badge variant={season.isActive ? "success" : "secondary"} className="shrink-0">
                      {season.isActive ? t("active") : t("closedStatus")}
                    </Badge>
                  </div>
                  {editing ? (
                    <div className="space-y-2">
                      <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
                        {t("startDate")}
                        <Input type="date" value={editForm.startDate} onChange={(event) => setEditForm({ ...editForm, startDate: event.target.value })} />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
                        {t("endDate")}
                        <Input type="date" value={editForm.endDate} onChange={(event) => setEditForm({ ...editForm, endDate: event.target.value })} />
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted">
                      {dateLabel(season.startDate)} → {dateLabel(season.endDate) || common("none")} · {season.snapshotCount} {t("snapshots")}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {editing ? (
                      <>
                        <Button size="sm" onClick={saveDates} disabled={busy || !editForm.startDate}>
                          <Check />{t("save")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditForm(null)} disabled={busy}>
                          <X />{common("cancel")}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => startEdit(season)} disabled={busy}>
                        <Edit />{t("editDates")}
                      </Button>
                    )}
                    {season.isActive && !editing && (
                      <Button size="sm" variant="ghost" onClick={() => closeSeason(season.id)} disabled={busy}>
                        <Lock />{t("close")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("startDate")}</TableHead>
                <TableHead>{t("endDate")}</TableHead>
                <TableHead>{t("snapshots")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((season) => {
                const editing = editForm?.id === season.id;
                return (
                  <TableRow key={season.id}>
                    <TableCell className="font-medium text-text-primary">{season.name}</TableCell>
                    <TableCell>
                      {editing ? (
                        <Input type="date" value={editForm.startDate} onChange={(event) => setEditForm({ ...editForm, startDate: event.target.value })} />
                      ) : (
                        dateLabel(season.startDate)
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <Input type="date" value={editForm.endDate} onChange={(event) => setEditForm({ ...editForm, endDate: event.target.value })} />
                      ) : (
                        dateLabel(season.endDate) || common("none")
                      )}
                    </TableCell>
                    <TableCell>{season.snapshotCount}</TableCell>
                    <TableCell>
                      <Badge variant={season.isActive ? "success" : "secondary"}>
                        {season.isActive ? t("active") : t("closedStatus")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {editing ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={saveDates} disabled={busy || !editForm.startDate}>
                              <Check />{t("save")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditForm(null)} disabled={busy}>
                              <X />{common("cancel")}
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => startEdit(season)} disabled={busy}>
                            <Edit />{t("editDates")}
                          </Button>
                        )}
                        {season.isActive && !editing && (
                          <Button variant="ghost" size="sm" onClick={() => closeSeason(season.id)} disabled={busy}>
                            <Lock />{t("close")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {seasons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-text-muted">{t("empty")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
