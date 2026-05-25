import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = "#e8a020",
  height = 28,
  className,
}: SparklineProps) {
  if (!data.length) return null;

  const width = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const area = `${points[0]} ${points.join(" ")} ${width},${height} 0,${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden="true"
    >
      <polyline points={area} fill={color} fillOpacity={0.08} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
