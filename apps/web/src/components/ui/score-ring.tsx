import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { healthTone, type HealthTone } from "./meter";

const RING_STROKE: Record<HealthTone, string> = {
  success: "stroke-success",
  warning: "stroke-warning",
  destructive: "stroke-destructive",
};

export function ringStroke(ratio: number): string {
  return RING_STROKE[healthTone(ratio)];
}

export function ringGeometry(
  value: number | null,
  max: number,
  size: number,
  stroke: number,
): { radius: number; circumference: number; offset: number; ratio: number } {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  return { radius, circumference, offset: circumference * (1 - ratio), ratio };
}

export function ScoreRing({
  value,
  max = 100,
  size = 132,
  stroke = 10,
  label,
  children,
}: {
  value: number | null;
  max?: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
}) {
  const { radius, circumference, offset, ratio } = ringGeometry(
    value,
    max,
    size,
    stroke,
  );

  return (
    <div
      role="img"
      aria-label={label}
      data-slot="score-ring"
      className="relative inline-grid place-items-center"
      style={{ inlineSize: size, blockSize: size }}
    >
      <svg aria-hidden width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            ringStroke(ratio),
            "motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300",
          )}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
