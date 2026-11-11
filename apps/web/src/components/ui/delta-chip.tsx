import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeltaPolarity = "higher-is-better" | "lower-is-better";

type Direction = "up" | "down" | "flat";

const GLYPH: Record<Direction, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

const TONE: Record<Direction, string> = {
  up: "text-signal-up",
  down: "text-signal-down",
  flat: "text-muted-foreground",
};

const PILL: Record<Direction, string> = {
  up: "bg-signal-up-subtle",
  down: "bg-signal-down-subtle",
  flat: "bg-secondary",
};

export type DeltaForm = "text" | "pill";

const PILL_SHAPE = "h-[22px] rounded-md px-[7px] text-label";

const formOf = (way: Direction, form: DeltaForm) =>
  form === "pill" ? cn(PILL_SHAPE, PILL[way]) : undefined;

function direction(value: number, polarity: DeltaPolarity): Direction {
  if (value === 0) return "flat";
  const improved = polarity === "lower-is-better" ? value < 0 : value > 0;
  return improved ? "up" : "down";
}

export function DeltaChip({
  value,
  polarity = "lower-is-better",
  period,
  unit = "",
  form = "text",
  className,
}: {
  value: number | null;
  polarity?: DeltaPolarity;
  period: string;
  unit?: string;
  form?: DeltaForm;
  className?: string;
}) {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (value === 0) {
    return (
      <span
        className={cn(
          "numeric text-muted-foreground",
          formOf("flat", form),
          className,
        )}
      >
        0
      </span>
    );
  }

  const way = direction(value, polarity);
  const Icon = GLYPH[way];
  const magnitude = Math.abs(value);

  return (
    <span
      aria-label={`${way} ${magnitude} ${period}`}
      className={cn(
        "numeric inline-flex items-center gap-0.5 font-medium",
        TONE[way],
        formOf(way, form),
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span>{`${magnitude}${unit}`}</span>
    </span>
  );
}

export function PositionDeltaChip({
  value,
  period = "since yesterday",
}: {
  value: number | null;
  period?: string;
}) {
  if (value === null || value === 0) return null;

  const way = direction(value, "lower-is-better");
  const Icon = GLYPH[way];
  const magnitude = Math.abs(value);

  return (
    <span
      aria-label={`${way} ${magnitude} ${period}`}
      className={cn(
        "numeric inline-flex items-center gap-0.5 text-label font-medium",
        TONE[way],
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span>{magnitude}</span>
    </span>
  );
}

export function TrendChip({
  label,
  value,
  unit = "",
  digits = 0,
  form = "text",
  labelled = true,
}: {
  label: string;
  value: number | null;
  unit?: string;
  digits?: number;
  form?: DeltaForm;
  labelled?: boolean;
}) {
  if (value === null) {
    return labelled ? (
      <span className="text-label text-muted-foreground">{`no ${label} data`}</span>
    ) : (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">{`no ${label} data`}</span>
      </span>
    );
  }

  const scale = 10 ** digits;
  const rounded = Math.round(value * scale) / scale;
  const way = direction(rounded, "higher-is-better");
  const Icon = GLYPH[way];
  const shown = rounded.toFixed(digits);
  const signed = rounded > 0 ? `+${shown}` : shown;

  return (
    <span
      className={cn(
        "numeric inline-flex items-center gap-0.5 text-label font-medium",
        TONE[way],
        formOf(way, form),
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {labelled ? (
        <span>{`${signed}${unit} ${label}`}</span>
      ) : (
        <>
          <span>{`${signed}${unit}`}</span>
          <span className="sr-only">{` ${label}`}</span>
        </>
      )}
    </span>
  );
}
