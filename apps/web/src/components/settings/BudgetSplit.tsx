import type { DailyBudget } from "@asobeast/shared";
import { formatNumber } from "@/lib/format";

const PARTS = [
  { key: "keywords", label: "Keywords", share: 100 },
  { key: "categories", label: "Categories", share: 62 },
  { key: "apps", label: "Apps", share: 38 },
  { key: "reviews", label: "Reviews", share: 20 },
] as const;

const tint = (share: number) =>
  `color-mix(in srgb, var(--brand-mark) ${share}%, var(--card))`;

export function BudgetSplit({ budget }: { budget: DailyBudget }) {
  const parts = PARTS.map((part) => ({ ...part, value: budget[part.key] }));
  const drawn = parts.filter((part) => part.value > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-label">Where the daily store requests go</p>
        <p className="numeric text-caption text-faint-foreground">
          {`${formatNumber(budget.total)} of ${formatNumber(budget.capacityPerDay)} a day`}
        </p>
      </div>
      {drawn.length > 0 ? (
        <div
          aria-hidden
          className="flex h-2 gap-0.5 overflow-hidden rounded-full"
        >
          {drawn.map((part) => (
            <span
              key={part.key}
              className="min-w-1"
              style={{ flexGrow: part.value, background: tint(part.share) }}
            />
          ))}
        </div>
      ) : null}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        {parts.map((part) => (
          <div key={part.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 rounded-xs"
              style={{ background: tint(part.share) }}
            />
            <dt>{part.label}</dt>
            <dd className="numeric font-medium text-foreground">
              {formatNumber(part.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
