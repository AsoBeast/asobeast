import { useTranslations } from "next-intl";
import type { OrderSummaryModel } from "@/lib/order-summary";

export function OrderSummary({ summary }: { summary: OrderSummaryModel }) {
  const t = useTranslations("billing");

  return (
    <section
      aria-labelledby="order-summary-title"
      className="flex flex-col gap-3 border-t border-border pt-6"
    >
      <h3 id="order-summary-title" className="text-heading">
        {t("orderSummary.title")}
      </h3>
      <dl className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="flex flex-col">
            <span className="font-medium">{summary.planName}</span>
            <span className="text-caption text-muted-foreground">
              {summary.intervalLabel}
            </span>
          </dt>
          <dd className="tabular-nums">{summary.unitAmount}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="text-heading">{t("orderSummary.dueToday")}</dt>
          <dd className="text-title tabular-nums">{summary.dueToday}</dd>
        </div>
      </dl>
      <p className="text-body">{summary.thenLine}</p>
      <p className="text-body text-muted-foreground">{summary.cancelLine}</p>
    </section>
  );
}
