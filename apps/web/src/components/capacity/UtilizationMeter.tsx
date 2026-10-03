import {
  utilizationLevel,
  utilizationPercent,
  type UtilizationLevel,
} from "@/lib/utilization";

const BAR_COLOR: Record<UtilizationLevel, string> = {
  ok: "bg-primary",
  warn: "bg-warning",
  danger: "bg-destructive",
};

export function UtilizationMeter({
  label,
  utilization,
}: {
  label: string;
  utilization: number;
}) {
  const percent = utilizationPercent(utilization);

  return (
    <div
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`h-full ${BAR_COLOR[utilizationLevel(utilization)]}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}
