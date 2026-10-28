"use client";

import { formatCountry } from "@/lib/format";
import { cn } from "@/lib/utils";

const pill = (selected: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-body transition-colors",
    selected
      ? "border-foreground bg-foreground text-background"
      : "hover:bg-muted",
  );

export function MarketPills({
  markets,
  value,
  onChange,
  ariaLabel,
  allLabel,
}: {
  markets: readonly { country: string; count: number }[];
  value: string | null;
  onChange: (next: string | null) => void;
  ariaLabel: string;
  allLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap items-center gap-2"
    >
      {allLabel ? (
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={pill(value === null)}
        >
          <span className="font-medium">{allLabel}</span>
          <span className="numeric font-mono text-caption opacity-70">
            {markets.reduce((sum, entry) => sum + entry.count, 0)}
          </span>
        </button>
      ) : null}
      {markets.map((entry) => {
        const selected = entry.country === value;
        return (
          <button
            key={entry.country}
            type="button"
            aria-pressed={selected}
            title={formatCountry(entry.country)}
            onClick={() => onChange(entry.country)}
            className={pill(selected)}
          >
            <span className="font-medium">{entry.country.toUpperCase()}</span>
            <span className="numeric font-mono text-caption opacity-70">
              {entry.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
