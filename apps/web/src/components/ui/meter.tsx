import { cn } from "@/lib/utils";

const TONE = {
  neutral: "bg-muted-foreground/60",
  score: "bg-score-mid",
  opportunity: "bg-score-high",
} as const;

export type MeterTone = keyof typeof TONE | "health";

export type HealthTone = "success" | "warning" | "destructive";

const HEALTH_BANDS = [
  { min: 0.7, tone: "success" },
  { min: 0.4, tone: "warning" },
] as const;

const HEALTH_FILL: Record<HealthTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export function healthTone(ratio: number): HealthTone {
  return HEALTH_BANDS.find((band) => ratio >= band.min)?.tone ?? "destructive";
}

export function healthFill(ratio: number): string {
  return HEALTH_FILL[healthTone(ratio)];
}

export function Meter({
  value,
  max = 100,
  tone = "neutral",
  fill,
  className,
}: {
  value: number;
  max?: number;
  tone?: MeterTone;
  fill?: string;
  className?: string;
}) {
  const ratio = Math.max(0, Math.min(1, value / max));

  return (
    <span
      aria-hidden
      data-slot="meter"
      className={cn(
        "block h-1 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <span
        className={cn(
          "block h-full rounded-full",
          fill ?? (tone === "health" ? healthFill(ratio) : TONE[tone]),
        )}
        style={{ inlineSize: `${ratio * 100}%` }}
      />
    </span>
  );
}
