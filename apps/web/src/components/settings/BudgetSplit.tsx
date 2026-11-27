import { useTranslations } from "next-intl";
import type { DailyBudget } from "@asobeast/shared";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

const PARTS = [
  { key: "keywords", labelKey: "keywords", share: 100 },
  { key: "categories", labelKey: "categories", share: 62 },
  { key: "apps", labelKey: "apps", share: 38 },
  { key: "reviews", labelKey: "reviews", share: 20 },
] as const;

const tint = (share: number) =>
  `color-mix(in srgb, var(--brand-mark) ${share}%, var(--card))`;

export function BudgetSplit({ budget }: { budget: DailyBudget }) {
  const t = useTranslations("settings");
  const locale = useAppLocale();
  const parts = PARTS.map((part) => ({ ...part, value: budget[part.key] }));
  const drawn = parts.filter((part) => part.value > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-label">{t("capacity.heading")}</p>
        <p className="numeric text-caption text-faint-foreground">
          {t("capacity.perDay", {
            used: budget.total,
            limit: budget.capacityPerDay,
          })}
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
            <dt>{t(`capacity.parts.${part.labelKey}`)}</dt>
            <dd className="numeric font-medium text-foreground">
              {formatNumberInLocale(part.value, locale)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
