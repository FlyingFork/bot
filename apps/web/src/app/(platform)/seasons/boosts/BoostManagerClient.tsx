"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import { 
  createBoostTask, 
  cancelBoostTask,
  applyBoost, 
  resetMemberCooldown,
  updateBoostSettings, 
  getBoostsData,
  syncOwnCooldown
} from "@/app/actions/boosts";
import { BoostType } from "@tiles-survive/database";
import { toast } from "sonner";
import { 
  Hammer, 
  Beaker, 
  Clock, 
  Settings2, 
  Plus, 
  Zap, 
  Check, 
  AlertCircle, 
  Trash2, 
  RefreshCw 
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

interface BoostManagerClientProps {
  initialData: Awaited<ReturnType<typeof getBoostsData>>;
  userRole: string;
}

function formatSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Завершено";
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0 || days > 0) parts.push(`${hours}ч`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}м`);
  parts.push(`${seconds}с`);

  return parts.join(" ");
}

export function BoostManagerClient({ initialData, userRole }: BoostManagerClientProps) {
  const t = useTranslations("phase2.boostManager");

  const [data, setData] = useState(initialData);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Task Form State
  const [taskType, setTaskType] = useState<BoostType>("CONSTRUCTION");
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  // Cooldown Sync State
  const [syncType, setSyncType] = useState<BoostType>("CONSTRUCTION");
  const [syncHours, setSyncHours] = useState(48);
  const [syncMinutes, setSyncMinutes] = useState(0);

  // Settings State
  const [prioMode, setPrioMode] = useState<"TIME" | "POWER" | "COMBINED">(
    initialData.settings.boostPriorityMode
  );
  const [weightPower, setWeightPower] = useState(initialData.settings.boostWeightPower);
  const [weightTime, setWeightTime] = useState(initialData.settings.boostWeightTime);
  const [minDaysConst, setMinDaysConst] = useState(initialData.settings.boostMinDaysConstruction);
  const [minDaysRes, setMinDaysRes] = useState(initialData.settings.boostMinDaysResearch);
  const [cooldownHours, setCooldownHours] = useState(initialData.settings.boostCooldownHours ?? 48);

  const isAdmin = userRole === "admin";
  const isR4Plus = userRole === "admin" || ["r4", "r5"].includes(userRole);

  // Real-time ticking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const now = new Date();
        
        // 1. Tick construction queue
        const updatedConstruction = prev.constructionQueue.map((t) => {
          const elapsed = BigInt(Math.floor((now.getTime() - new Date(t.startedAt).getTime()) / 1000));
          const remaining = t.totalDurationSeconds - Number(elapsed) - t.boostSecondsApplied;
          return { ...t, remainingSeconds: Math.max(0, remaining) };
        }).filter((t) => t.remainingSeconds > 0);

        // 2. Tick research queue
        const updatedResearch = prev.researchQueue.map((t) => {
          const elapsed = BigInt(Math.floor((now.getTime() - new Date(t.startedAt).getTime()) / 1000));
          const remaining = t.totalDurationSeconds - Number(elapsed) - t.boostSecondsApplied;
          return { ...t, remainingSeconds: Math.max(0, remaining) };
        }).filter((t) => t.remainingSeconds > 0);

        // 3. Tick members cooldowns
        const updatedMembers = prev.membersStatus.map((m) => {
          const newConstCd = Math.max(0, m.constCooldownRemainingSeconds - 1);
          const newResCd = Math.max(0, m.resCooldownRemainingSeconds - 1);
          return {
            ...m,
            constCooldownRemainingSeconds: newConstCd,
            isConstCooldown: newConstCd > 0,
            resCooldownRemainingSeconds: newResCd,
            isResCooldown: newResCd > 0,
          };
        });

        // 4. Tick current user cooldowns
        const currentUserConstCooldownSeconds = Math.max(0, prev.currentUserConstCooldownSeconds - 1);
        const currentUserResCooldownSeconds = Math.max(0, prev.currentUserResCooldownSeconds - 1);

        return {
          ...prev,
          constructionQueue: updatedConstruction,
          researchQueue: updatedResearch,
          recommendedConstruction: updatedConstruction.find(t => !t.belowLimit) || null,
          recommendedResearch: updatedResearch.find(t => !t.belowLimit) || null,
          membersStatus: updatedMembers,
          currentUserConstCooldown: currentUserConstCooldownSeconds > 0,
          currentUserConstCooldownSeconds,
          currentUserResCooldown: currentUserResCooldownSeconds > 0,
          currentUserResCooldownSeconds,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update sync inputs when dialog opens or sync type changes
  useEffect(() => {
    if (isSyncOpen) {
      const remainingSeconds = syncType === "CONSTRUCTION"
        ? data.currentUserConstCooldownSeconds
        : data.currentUserResCooldownSeconds;

      if (remainingSeconds > 0) {
        const h = Math.floor(remainingSeconds / 3600);
        const m = Math.floor((remainingSeconds % 3600) / 60);
        if (h === 0 && m === 0) {
          setSyncHours(0);
          setSyncMinutes(1);
        } else {
          setSyncHours(h);
          setSyncMinutes(m);
        }
      } else {
        setSyncHours(data.settings.boostCooldownHours ?? 48);
        setSyncMinutes(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncOpen, syncType]);

  // Fetch fresh data from server helper
  async function refreshData() {
    try {
      const freshData = await getBoostsData();
      setData(freshData);
    } catch (e) {
      console.error("Failed to refresh boosts data", e);
    }
  }

  // Handle task submission
  async function handleSubmitTask(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createBoostTask(taskType, days, hours, minutes);
      if (res.success) {
        toast.success(t("toastSuccessCreate"));
        setIsSubmitOpen(false);
        setDays(0);
        setHours(0);
        setMinutes(0);
        await refreshData();
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || "Произошла ошибка при создании задачи");
    } finally {
      setLoading(false);
    }
  }

  // Handle task cancellation
  async function handleCancelTask(taskId: string) {
    const confirmed = confirm(t("confirmCancelTask"));
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await cancelBoostTask(taskId);
      if (res.success) {
        toast.success(t("toastSuccessCancel"));
        await refreshData();
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || "Не удалось отменить задачу");
    } finally {
      setLoading(false);
    }
  }

  // Handle reset cooldown (Admin only)
  async function handleResetCooldown(memberId: string, type: BoostType, username: string) {
    const typeLabel = type === "CONSTRUCTION" ? "Строительство" : "Исследования";
    const confirmed = confirm(t("confirmResetCooldown", { type: typeLabel, username }));
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await resetMemberCooldown(memberId, type);
      if (res.success) {
        toast.success(t("toastSuccessReset", { type: typeLabel, username }));
        await refreshData();
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || "Не удалось сбросить кулдаун");
    } finally {
      setLoading(false);
    }
  }

  // Handle give boost action
  async function handleGiveBoost(taskId: string, percentage: number) {
    const confirmed = confirm(t("confirmGiveBoost", { pct: percentage, hours: data.settings.boostCooldownHours }));
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await applyBoost(taskId, percentage);
      if (res.success) {
        toast.success(t("toastSuccessBoost", { pct: percentage }));
        await refreshData();
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || "Не удалось применить буст");
    } finally {
      setLoading(false);
    }
  }

  // Handle save priority/limit settings (Admin only)
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await updateBoostSettings(prioMode, weightPower, weightTime, minDaysConst, minDaysRes, cooldownHours);
      if (res.success) {
        toast.success(t("toastSuccessSettings"));
        setIsSettingsOpen(false);
        await refreshData();
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || "Не удалось сохранить настройки");
    } finally {
      setLoading(false);
    }
  }

  // Handle manual cooldown sync
  async function handleSyncCooldown(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await syncOwnCooldown(syncType, syncHours, syncMinutes);
      if (res.success) {
        toast.success(t("toastSuccessSync"));
        setIsSyncOpen(false);
        await refreshData();
      }
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || "Не удалось синхронизировать КД");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* LEFT 3 COLUMNS: DASHBOARD CARD ACTIONS & QUEUE */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* RECOMMENDED TARGETS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Construction Recommended */}
          <Card className="border border-border-line bg-surface relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Hammer size={72} className="text-gold" />
            </div>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded bg-gold/10 text-gold">
                  <Hammer size={18} />
                </div>
                <CardTitle className="text-base font-bold">{t("recommendationTitleConst")}</CardTitle>
              </div>
              <CardDescription>{t("recommendedTargetConst")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.recommendedConstruction ? (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-text truncate">
                      {data.recommendedConstruction.memberName}
                    </h3>
                    <p className="text-xs text-muted flex gap-2">
                      <span>{t("powerFormat", { power: (data.recommendedConstruction.memberPower / 1_000_000).toFixed(1) })}</span>
                      <span>•</span>
                      <span>{t("colRemaining")}: {formatSeconds(data.recommendedConstruction.remainingSeconds)}</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {[5, 10, 15].map((pct) => (
                      <Button
                        key={pct}
                        size="sm"
                        variant={pct === 15 ? "default" : "outline"}
                        disabled={
                          data.currentUserConstCooldown || 
                          loading || 
                          data.recommendedConstruction?.memberId === data.currentUserAllianceMemberId
                        }
                        className={pct === 15 ? "bg-gold text-bg hover:bg-gold-hover font-semibold flex-1" : "flex-1"}
                        onClick={() => handleGiveBoost(data.recommendedConstruction!.id, pct)}
                      >
                        +{pct}%
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[96px] flex flex-col items-center justify-center text-center text-xs text-muted border border-dashed border-border-line rounded-lg">
                  <AlertCircle size={20} className="mb-1" />
                  {t("noActiveTasksConst")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Research Recommended */}
          <Card className="border border-border-line bg-surface relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Beaker size={72} className="text-gold" />
            </div>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded bg-gold/10 text-gold">
                  <Beaker size={18} />
                </div>
                <CardTitle className="text-base font-bold">{t("recommendationTitleRes")}</CardTitle>
              </div>
              <CardDescription>{t("recommendedTargetRes")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.recommendedResearch ? (
                <>
                  <div>
                    <h3 className="text-lg font-bold text-text truncate">
                      {data.recommendedResearch.memberName}
                    </h3>
                    <p className="text-xs text-muted flex gap-2">
                      <span>{t("powerFormat", { power: (data.recommendedResearch.memberPower / 1_000_000).toFixed(1) })}</span>
                      <span>•</span>
                      <span>{t("colRemaining")}: {formatSeconds(data.recommendedResearch.remainingSeconds)}</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {[5, 10, 15].map((pct) => (
                      <Button
                        key={pct}
                        size="sm"
                        variant={pct === 15 ? "default" : "outline"}
                        disabled={
                          data.currentUserResCooldown || 
                          loading || 
                          data.recommendedResearch?.memberId === data.currentUserAllianceMemberId
                        }
                        className={pct === 15 ? "bg-gold text-bg hover:bg-gold-hover font-semibold flex-1" : "flex-1"}
                        onClick={() => handleGiveBoost(data.recommendedResearch!.id, pct)}
                      >
                        +{pct}%
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[96px] flex flex-col items-center justify-center text-center text-xs text-muted border border-dashed border-border-line rounded-lg">
                  <AlertCircle size={20} className="mb-1" />
                  {t("noActiveTasksRes")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CONTROLS HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <Button
              onClick={() => setIsSubmitOpen(true)}
              className="bg-gold text-bg hover:bg-gold-hover font-semibold gap-1.5"
            >
              <Plus size={16} /> {t("addTask")}
            </Button>

            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setIsSettingsOpen(true)}
                className="gap-1.5"
              >
                <Settings2 size={16} /> {t("settingsAndLimits")}
              </Button>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 text-right">
            <div className="text-xs text-muted">
              {t("sortMode")} <Badge variant="outline" className="ml-1 text-[10px] uppercase font-bold text-gold border-gold/30">
                {data.settings.boostPriorityMode === "TIME" && t("sortModeTime")}
                {data.settings.boostPriorityMode === "POWER" && t("sortModePower")}
                {data.settings.boostPriorityMode === "COMBINED" && t("sortModeCombined")}
              </Badge>
            </div>
            {(data.settings.boostMinDaysConstruction > 0 || data.settings.boostMinDaysResearch > 0) && (
              <div className="text-[10px] text-muted">
                {t("boostLimits")} {data.settings.boostMinDaysConstruction > 0 && t("limitConst", { days: data.settings.boostMinDaysConstruction })}
                {data.settings.boostMinDaysResearch > 0 && t("limitRes", { days: data.settings.boostMinDaysResearch })}
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE QUEUES TABLES */}
        <Card className="border border-border-line bg-surface">
          <CardHeader className="pb-0 border-b border-border-line">
            <CardTitle className="text-base font-bold pb-4">{t("queueTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border-line hover:bg-transparent">
                    <TableHead className="w-[10%]">{t("colType")}</TableHead>
                    <TableHead className="w-[18%]">{t("colPlayer")}</TableHead>
                    <TableHead className="w-[10%]">{t("colPower")}</TableHead>
                    <TableHead className="w-[14%]">{t("colOriginal")}</TableHead>
                    <TableHead className="w-[16%]">{t("colRemaining")}</TableHead>
                    <TableHead className="w-[12%]">{t("colBoosts")}</TableHead>
                    <TableHead className="w-[20%] text-right">{t("colAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.constructionQueue, ...data.researchQueue].length === 0 ? (
                    <TableRow className="hover:bg-transparent border-none">
                      <TableCell colSpan={7} className="h-32 text-center text-xs text-muted">
                        {t("emptyQueue")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    [
                      ...data.constructionQueue.map(t => ({ ...t, isConstruction: true })),
                      ...data.researchQueue.map(t => ({ ...t, isConstruction: false }))
                    ]
                    .sort((a, b) => b.priorityScore - a.priorityScore)
                    .map((task) => {
                      const isCurrentUserTask = task.memberId === data.currentUserAllianceMemberId;
                      const showCancelButton = isCurrentUserTask || isR4Plus;
                      
                      return (
                        <TableRow 
                          key={task.id} 
                          className={`border-b border-border-line/50 hover:bg-surface-2/40 ${isCurrentUserTask ? 'bg-gold/5 font-medium' : ''}`}
                        >
                          <TableCell>
                            {task.isConstruction ? (
                              <Badge className="bg-gold/10 hover:bg-gold/10 text-gold font-bold gap-1 text-[10px] border-none py-0.5 px-2">
                                <Hammer size={10} /> {task.isConstruction ? "Стройка" : "Наука"}
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-500/10 hover:bg-blue-500/10 text-blue-400 font-bold gap-1 text-[10px] border-none py-0.5 px-2">
                                <Beaker size={10} /> {task.isConstruction ? "Стройка" : "Наука"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-text truncate max-w-[140px]">
                            {task.memberName} {isCurrentUserTask && <span className="text-[10px] text-gold font-bold ml-1">{t("youLabel")}</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted">
                            {(task.memberPower / 1_000_000).toFixed(1)}M
                          </TableCell>
                          <TableCell className="text-xs text-muted">
                            {formatSeconds(task.totalDurationSeconds)}
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold text-text-light">
                            <div className="flex flex-col gap-0.5">
                              <span>{formatSeconds(task.remainingSeconds)}</span>
                              {task.belowLimit && (
                                <span className="text-[9px] text-red-400 font-normal">{t("belowLimitLabel")}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.boosts.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {task.boosts.map((b, i) => (
                                  <Badge 
                                    key={i} 
                                    variant="outline" 
                                    className="text-[9px] px-1 py-0 border-gold/30 bg-gold/5 text-gold"
                                    title={`От: ${b.appliedBy} в ${new Date(b.appliedAt).toLocaleTimeString()}`}
                                  >
                                    +{b.boostPercentage}%
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isCurrentUserTask && (
                                <div className="flex gap-1 mr-1">
                                  {[5, 10, 15].map((pct) => {
                                    const isCooldown = task.isConstruction 
                                      ? data.currentUserConstCooldown 
                                      : data.currentUserResCooldown;
                                    return (
                                      <Button
                                        key={pct}
                                        size="xs"
                                        variant="outline"
                                        disabled={
                                          isCooldown || 
                                          task.belowLimit || 
                                          loading
                                        }
                                        className="h-6 px-1.5 text-[10px] font-semibold hover:border-gold hover:text-gold"
                                        onClick={() => handleGiveBoost(task.id, pct)}
                                        title={`Дать буст ${pct}%`}
                                      >
                                        +{pct}%
                                      </Button>
                                    );
                                  })}
                                </div>
                              )}
                              {showCancelButton && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={loading}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 h-8 w-8 flex items-center justify-center"
                                  onClick={() => handleCancelTask(task.id)}
                                  title={t("cancelTaskTooltip")}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT SIDE PANEL: ALLIANCE MEMBER COOLDOWNS */}
      <div className="space-y-6">
        {/* CURRENT USER STATUS CARD */}
        <Card className="border border-border-line bg-surface">
          <CardHeader className="pb-3 border-b border-border-line">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Zap size={14} className="text-gold" /> {t("yourSkillCard")}</span>
              {data.currentUserAllianceMemberId && (
                <button 
                  onClick={() => setIsSyncOpen(true)}
                  className="text-[10px] text-gold hover:underline font-semibold flex items-center gap-0.5"
                >
                  <RefreshCw size={10} /> {t("syncCooldownBtn")}
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {data.currentUserAllianceMemberId ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider">{t("skillCooldownsHeader")}</h4>
                  {/* Construction CD */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted flex items-center gap-1">
                      <Hammer size={12} /> {t("modalAddTypeConst")}:
                    </span>
                    {data.currentUserConstCooldown ? (
                      <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/5 font-bold gap-1 text-[10px]">
                        <Clock size={10} /> {t("cooldownStatus")} {formatSeconds(data.currentUserConstCooldownSeconds)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/5 font-bold gap-1 text-[10px]">
                        <Check size={10} /> {t("readyStatus")}
                      </Badge>
                    )}
                  </div>

                  {/* Research CD */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted flex items-center gap-1">
                      <Beaker size={12} /> {t("modalAddTypeRes")}:
                    </span>
                    {data.currentUserResCooldown ? (
                      <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/5 font-bold gap-1 text-[10px]">
                        <Clock size={10} /> {t("cooldownStatus")} {formatSeconds(data.currentUserResCooldownSeconds)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/5 font-bold gap-1 text-[10px]">
                        <Check size={10} /> {t("readyStatus")}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-border-line/40 space-y-2">
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider">{t("activeTasksHeader")}</h4>
                  {/* Active Construction Task */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted flex items-center gap-1">
                      <Hammer size={12} /> {t("modalAddTypeConst")}:
                    </span>
                    {data.constructionQueue.find(t => t.memberId === data.currentUserAllianceMemberId) ? (() => {
                      const myTask = data.constructionQueue.find(t => t.memberId === data.currentUserAllianceMemberId)!;
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-gold font-bold">{formatSeconds(myTask.remainingSeconds)}</span>
                          <button
                            disabled={loading}
                            onClick={() => handleCancelTask(myTask.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 rounded"
                            title={t("cancelTaskTooltip")}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })() : (
                      <span className="text-muted text-[11px]">{t("noneStatus")}</span>
                    )}
                  </div>

                  {/* Active Research Task */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted flex items-center gap-1">
                      <Beaker size={12} /> {t("modalAddTypeRes")}:
                    </span>
                    {data.researchQueue.find(t => t.memberId === data.currentUserAllianceMemberId) ? (() => {
                      const myTask = data.researchQueue.find(t => t.memberId === data.currentUserAllianceMemberId)!;
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-blue-400 font-bold">{formatSeconds(myTask.remainingSeconds)}</span>
                          <button
                            disabled={loading}
                            onClick={() => handleCancelTask(myTask.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1 rounded"
                            title={t("cancelTaskTooltip")}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })() : (
                      <span className="text-muted text-[11px]">{t("noneStatus")}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted flex gap-2 items-start">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {t("unlinkedWarning")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* COOLDOWNS LIST */}
        <Card className="border border-border-line bg-surface flex flex-col h-[524px]">
          <CardHeader className="pb-3 border-b border-border-line shrink-0">
            <CardTitle className="text-sm font-bold">{t("cooldownsListTitle")}</CardTitle>
            <CardDescription className="text-xs">{t("cooldownsListSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto flex-1">
            <div className="divide-y divide-border-line/40">
              {data.membersStatus.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">
                  {t("allianceMembersEmpty")}
                </div>
              ) : (
                data.membersStatus.map((m) => (
                  <div key={m.memberId} className="flex flex-col gap-1.5 p-3 hover:bg-surface-2/20">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-text truncate max-w-[130px]">{m.username}</p>
                        <p className="text-[10px] text-muted">{t("powerFormat", { power: (m.power / 1_000_000).toFixed(1) })}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-line/20">
                      {/* Const Status */}
                      <div className="flex items-center justify-between bg-surface-2/30 rounded p-1.5 text-[10px]">
                        <span className="text-muted flex gap-1 items-center">
                          <Hammer size={10} />
                        </span>
                        <div className="flex items-center gap-1.5">
                          {m.isConstCooldown ? (
                            <>
                              <span className="font-mono text-red-400 font-bold" title={t("cooldownRemainingTitleConst")}>
                                {formatSeconds(m.constCooldownRemainingSeconds)}
                              </span>
                              {isAdmin && (
                                <button
                                  disabled={loading}
                                  onClick={() => handleResetCooldown(m.memberId, "CONSTRUCTION", m.username)}
                                  className="text-gold hover:text-gold-hover"
                                  title={t("resetCooldownTooltipConst")}
                                >
                                  <RefreshCw size={10} />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-green-400 font-bold">{t("readyStatus")}</span>
                          )}
                        </div>
                      </div>

                      {/* Res Status */}
                      <div className="flex items-center justify-between bg-surface-2/30 rounded p-1.5 text-[10px]">
                        <span className="text-muted flex gap-1 items-center">
                          <Beaker size={10} />
                        </span>
                        <div className="flex items-center gap-1.5">
                          {m.isResCooldown ? (
                            <>
                              <span className="font-mono text-red-400 font-bold" title={t("cooldownRemainingTitleRes")}>
                                {formatSeconds(m.resCooldownRemainingSeconds)}
                              </span>
                              {isAdmin && (
                                <button
                                  disabled={loading}
                                  onClick={() => handleResetCooldown(m.memberId, "RESEARCH", m.username)}
                                  className="text-gold hover:text-gold-hover"
                                  title={t("resetCooldownTooltipRes")}
                                >
                                  <RefreshCw size={10} />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-green-400 font-bold">{t("readyStatus")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DIALOG 1: SUBMIT TASK MODAL */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="border border-border-line bg-surface max-w-md">
          <form onSubmit={handleSubmitTask}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">{t("modalAddTitle")}</DialogTitle>
              <DialogDescription className="text-xs">
                {t("modalAddSubtitle")}
              </DialogDescription>
            </DialogHeader>

            {/* Added px-6 to set horizontal spacing inside the dialog */}
            <div className="px-6 py-6 space-y-4">
              {/* Task Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">{t("modalAddTypeLabel")}</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={taskType === "CONSTRUCTION" ? "default" : "outline"}
                    className={taskType === "CONSTRUCTION" ? "bg-gold text-bg hover:bg-gold-hover font-semibold flex-1" : "flex-1"}
                    onClick={() => setTaskType("CONSTRUCTION")}
                  >
                    {t("modalAddTypeConst")}
                  </Button>
                  <Button
                    type="button"
                    variant={taskType === "RESEARCH" ? "default" : "outline"}
                    className={taskType === "RESEARCH" ? "bg-gold text-bg hover:bg-gold-hover font-semibold flex-1" : "flex-1"}
                    onClick={() => setTaskType("RESEARCH")}
                  >
                    {t("modalAddTypeRes")}
                  </Button>
                </div>
              </div>

              {/* Duration Inputs */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">{t("modalAddDurationLabel")}</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted">{t("modalAddDays")}</label>
                    <Input
                      type="number"
                      min={0}
                      value={days}
                      onChange={(e) => setDays(Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-surface-2 border-border-line text-center text-sm font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted">{t("modalAddHours")}</label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                      className="bg-surface-2 border-border-line text-center text-sm font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted">{t("modalAddMinutes")}</label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="bg-surface-2 border-border-line text-center text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitOpen(false)}
                disabled={loading}
              >
                {t("modalAddCancel")}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gold text-bg hover:bg-gold-hover font-semibold"
              >
                {t("modalAddSubmit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: SETTINGS MODAL */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="border border-border-line bg-surface max-w-md">
          <form onSubmit={handleSaveSettings}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">{t("modalSettingsTitle")}</DialogTitle>
              <DialogDescription className="text-xs">
                {t("modalSettingsSubtitle")}
              </DialogDescription>
            </DialogHeader>

            {/* Use pl-6 and pr-4 to leave appropriate breathing room on the right side next to the scrollbar */}
            <div className="pl-6 pr-4 py-4 space-y-4 max-h-[380px] overflow-y-auto">
              {/* Prio Mode Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">{t("modalSettingsCriteria")}</label>
                <select
                  value={prioMode}
                  onChange={(e) => setPrioMode(e.target.value as "TIME" | "POWER" | "COMBINED")}
                  className="w-full h-9 rounded-md border border-border-line bg-surface-2 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gold"
                >
                  <option value="TIME">{t("modalSettingsOptTime")}</option>
                  <option value="POWER">{t("modalSettingsOptPower")}</option>
                  <option value="COMBINED">{t("modalSettingsOptCombined")}</option>
                </select>
              </div>

              {/* Combined Mode Sliders */}
              {prioMode === "COMBINED" && (
                <div className="space-y-4 border border-border-line/60 rounded-lg p-3 bg-surface-2/20">
                  <p className="text-[10px] text-muted leading-relaxed">
                    {t("modalSettingsCombinedHint")}
                  </p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{t("modalSettingsWeightPower")}</span>
                      <span className="text-gold">{(weightPower * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={weightPower}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setWeightPower(val);
                        setWeightTime(parseFloat((1 - val).toFixed(1)));
                      }}
                      className="w-full accent-gold bg-border-line"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{t("modalSettingsWeightTime")}</span>
                      <span className="text-gold">{(weightTime * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={weightTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setWeightTime(val);
                        setWeightPower(parseFloat((1 - val).toFixed(1)));
                      }}
                      className="w-full accent-gold bg-border-line"
                    />
                  </div>
                </div>
              )}

              {/* Cooldown Configuration */}
              <div className="space-y-1.5 pt-2 border-t border-border-line/40">
                <label className="text-xs font-semibold text-muted flex gap-1.5 items-center">
                  <Clock size={12} /> {t("modalSettingsCooldownLabel")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={cooldownHours}
                  onChange={(e) => setCooldownHours(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-surface-2 border-border-line"
                />
              </div>

              {/* Limits Configuration */}
              <div className="space-y-3 pt-2 border-t border-border-line/40">
                <h4 className="text-xs font-bold text-text">{t("modalSettingsLimitsLabel")}</h4>
                <p className="text-[10px] text-muted">
                  {t("modalSettingsLimitsHint")}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted flex gap-1 items-center">
                      <Hammer size={10} /> {t("modalSettingsLimitConst")}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={minDaysConst}
                      onChange={(e) => setMinDaysConst(Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-surface-2 border-border-line"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-muted flex gap-1 items-center">
                      <Beaker size={10} /> {t("modalSettingsLimitRes")}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={minDaysRes}
                      onChange={(e) => setMinDaysRes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-surface-2 border-border-line"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3 border-t border-border-line/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSettingsOpen(false)}
                disabled={loading}
              >
                {t("modalSettingsCancel")}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gold text-bg hover:bg-gold-hover font-semibold"
              >
                {t("modalSettingsSave")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: MANUAL COOLDOWN SYNC MODAL */}
      <Dialog open={isSyncOpen} onOpenChange={setIsSyncOpen}>
        <DialogContent className="border border-border-line bg-surface max-w-md">
          <form onSubmit={handleSyncCooldown}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">{t("modalSyncTitle")}</DialogTitle>
              <DialogDescription className="text-xs">
                {t("modalSyncSubtitle")}
              </DialogDescription>
            </DialogHeader>

            {/* Added px-6 to set horizontal spacing inside sync dialog */}
            <div className="px-6 py-6 space-y-4">
              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">{t("modalAddTypeLabel")}</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={syncType === "CONSTRUCTION" ? "default" : "outline"}
                    className={syncType === "CONSTRUCTION" ? "bg-gold text-bg hover:bg-gold-hover font-semibold flex-1" : "flex-1"}
                    onClick={() => setSyncType("CONSTRUCTION")}
                  >
                    {t("modalAddTypeConst")}
                  </Button>
                  <Button
                    type="button"
                    variant={syncType === "RESEARCH" ? "default" : "outline"}
                    className={syncType === "RESEARCH" ? "bg-gold text-bg hover:bg-gold-hover font-semibold flex-1" : "flex-1"}
                    onClick={() => setSyncType("RESEARCH")}
                  >
                    {t("modalAddTypeRes")}
                  </Button>
                </div>
              </div>

              {/* Time inputs */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted">Оставшееся время кулдауна в игре</label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted">{t("modalSyncHours")}</label>
                    <Input
                      type="number"
                      min={0}
                      value={syncHours}
                      onChange={(e) => setSyncHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="bg-surface-2 border-border-line text-center text-sm font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted">{t("modalSyncMinutes")}</label>
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      value={syncMinutes}
                      onChange={(e) => setSyncMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="bg-surface-2 border-border-line text-center text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSyncOpen(false)}
                disabled={loading}
              >
                {t("modalAddCancel")}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-gold text-bg hover:bg-gold-hover font-semibold"
              >
                {t("modalSyncSubmit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
