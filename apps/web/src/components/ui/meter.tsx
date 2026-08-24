import { cn } from "@/lib/utils";

const TONE = {
  neutral: "bg-muted-foreground/60",
  score: "bg-score-mid",
  opportunity: "bg-score-high",
} as const;

export type MeterTone = keyof typeof TONE | "health";

const HEALTH = [
  { min: 0.7, fill: "bg-success" },
  { min: 0.4, fill: "bg-warning" },
] as const;

export function healthFill(ratio: number): string {
  return HEALTH.find((band) => ratio >= band.min)?.fill ?? "bg-destructive";
}

export function Meter({
  value,
  max = 100,
  tone = "neutral",
  className,
}: {
  value: number;
  max?: number;
  tone?: MeterTone;
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
          tone === "health" ? healthFill(ratio) : TONE[tone],
        )}
        style={{ inlineSize: `${ratio * 100}%` }}
      />
    </span>
  );
}
