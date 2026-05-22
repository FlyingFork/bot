"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import type {
  DashboardBucket,
  DashboardEventTrendPoint,
  DashboardPowerTrendPoint,
  DashboardRankTrendPoint,
} from "@/lib/alliance-dashboard";

type RechartsTooltipEntry = {
  color?: string;
  fill?: string;
  name?: string;
  stroke?: string;
  value?: number | string;
};

type DashboardTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: RechartsTooltipEntry[];
};

const CHART_HEIGHT = 288;

function formatAxisValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function DashboardTooltip({ active, label, payload }: DashboardTooltipProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard.charts");

  return (
    <ChartTooltip
      active={active}
      label={label === undefined ? undefined : String(label)}
      locale={locale}
      payload={payload?.map((entry) => ({
        color: entry.color ?? entry.stroke ?? entry.fill ?? "#00D2FF",
        name: entry.name ?? t("seriesValue"),
        value: Number(entry.value ?? 0),
      }))}
    />
  );
}

export function RosterPowerTrendChart({
  data,
}: {
  data: DashboardPowerTrendPoint[];
}) {
  const locale = useLocale();
  const t = useTranslations("dashboard.charts");

  return (
    <div className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 2, bottom: 8 }}>
          <defs>
            <linearGradient id="rosterPowerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D2FF" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#00D2FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={20} />
          <YAxis tickFormatter={(value) => formatAxisValue(value, locale)} width={58} />
          <Tooltip content={<DashboardTooltip />} />
          <Area
            dataKey="totalPower"
            fill="url(#rosterPowerFill)"
            name={t("seriesAlliancePower")}
            stroke="#00D2FF"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MemberDistributionChart({
  color,
  data,
}: {
  color: string;
  data: DashboardBucket[];
}) {
  const t = useTranslations("dashboard.charts");

  return (
    <div className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 12, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis allowDecimals={false} type="number" />
          <YAxis dataKey="label" type="category" width={76} />
          <Tooltip content={<DashboardTooltip />} />
          <Bar dataKey="value" fill={color} name={t("seriesMembers")} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EventTrendChart({
  color,
  data,
}: {
  color: string;
  data: DashboardEventTrendPoint[];
}) {
  const locale = useLocale();
  const t = useTranslations("dashboard.charts");

  return (
    <div className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 2, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={20} />
          <YAxis
            tickFormatter={(value) => formatAxisValue(value, locale)}
            width={58}
            yAxisId="power"
          />
          <YAxis allowDecimals={false} orientation="right" width={34} yAxisId="members" />
          <Tooltip content={<DashboardTooltip />} />
          <Bar
            dataKey="memberCount"
            fill="#8292B4"
            fillOpacity={0.28}
            name={t("seriesCapturedPlayers")}
            radius={[3, 3, 0, 0]}
            yAxisId="members"
          />
          <Line
            dataKey="totalPower"
            dot={{ r: 2 }}
            name={t("seriesCapturedPower")}
            stroke={color}
            strokeWidth={2}
            type="monotone"
            yAxisId="power"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const RANK_COLORS: Record<string, string> = {
  R5: "#FFD700",
  R4: "#00D2FF",
  R3: "#00E676",
  R2: "#8292B4",
  R1: "#4A5568",
};

export function RankCompositionChart({
  data,
}: {
  data: DashboardRankTrendPoint[];
}) {
  const t = useTranslations("dashboard.charts");
  const ranks: (keyof DashboardRankTrendPoint)[] = ["R5", "R4", "R3", "R2", "R1"];

  return (
    <div className="min-w-0 w-full">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 2, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={20} />
          <YAxis allowDecimals={false} width={34} />
          <Tooltip content={<DashboardTooltip />} />
          <Legend />
          {ranks.map((rank) => (
            <Bar
              key={rank}
              dataKey={rank}
              fill={RANK_COLORS[rank] ?? "#8292B4"}
              name={t(`series${rank}` as Parameters<typeof t>[0])}
              stackId="ranks"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
