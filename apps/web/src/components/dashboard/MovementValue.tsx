import type { PortfolioMovement } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { DirectionArrow } from "@/components/ui/delta-chip";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

type Moved = Pick<PortfolioMovement, "up" | "down">;

function Side({
  way,
  count,
  locale,
}: {
  way: "up" | "down";
  count: number;
  locale: ReturnType<typeof useAppLocale>;
}) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      <DirectionArrow
        way={way}
        className={way === "up" ? "text-signal-up" : "text-signal-down"}
      />
      <span>{formatNumberInLocale(count, locale)}</span>
    </span>
  );
}

export function MovementValue({ movement }: { movement: Moved }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  const quiet = movement.up + movement.down === 0;
  return (
    <>
      <span aria-hidden className="inline-flex items-center gap-2">
        {quiet ? (
          <span className="text-muted-foreground">
            {formatNumberInLocale(0, locale)}
          </span>
        ) : null}
        <Side way="up" count={movement.up} locale={locale} />
        <Side way="down" count={movement.down} locale={locale} />
      </span>
      <span className="sr-only">
        {t("movement.spoken", { up: movement.up, down: movement.down })}
      </span>
    </>
  );
}
