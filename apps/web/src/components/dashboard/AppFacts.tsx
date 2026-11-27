import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PortfolioApp, PortfolioAppInsight } from "@asobeast/shared";
import { GradedNumber } from "@/components/ui/graded";
import {
  formatCompactInLocale,
  formatNumberInLocale,
  formatRatingInLocale,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { grade } from "@/lib/grade";
import { discoveriesHref, discoveriesLine } from "@/lib/keyword-discoveries";

const FACT_LINK =
  "relative z-20 inline-flex min-h-6 items-center underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function RatingFact({ rating }: { rating: PortfolioAppInsight["rating"] }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  if (rating.average === null) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden>{t("cards.rating")}</span>
      <GradedNumber
        value={formatRatingInLocale(rating.average, locale)}
        grade={grade("rating", rating.average)}
        label={t("cards.rating")}
      />
      {rating.count === null ? null : (
        <span>({formatCompactInLocale(rating.count, locale)})</span>
      )}
    </span>
  );
}

function AuditFact({ audit }: { audit: PortfolioAppInsight["audit"] }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  if (audit?.current == null) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden>{t("cards.audit")}</span>
      <GradedNumber
        value={formatNumberInLocale(audit.current, locale)}
        grade={grade("audit", audit.current)}
        label={t("cards.audit")}
      />
    </span>
  );
}

function ForApp({ app }: { app: PortfolioApp }) {
  const t = useTranslations("dashboard");
  return (
    <span className="sr-only">
      {t("cards.forApp", { name: app.name ?? t("cards.thisApp") })}
    </span>
  );
}

function ActionsFact({
  app,
  actions,
}: {
  app: PortfolioApp;
  actions: PortfolioAppInsight["actions"];
}) {
  const t = useTranslations("dashboard");
  if (!actions || actions.open === 0) return null;
  return (
    <Link href={`/apps/${app.id}/actions`} className={FACT_LINK}>
      {t("counts.openActions", { count: actions.open })}
      <ForApp app={app} />
      {actions.critical > 0 ? (
        <span className="text-priority-critical">
          {t("cards.critical", { count: actions.critical })}
        </span>
      ) : null}
    </Link>
  );
}

function DiscoveriesFact({ app }: { app: PortfolioApp }) {
  const t = useTranslations("keywordInspector");
  const line = discoveriesLine(app.discoveries, t);
  if (line === null) return null;
  return (
    <Link href={discoveriesHref(app.id)} className={FACT_LINK}>
      {line}
      <ForApp app={app} />
    </Link>
  );
}

function ReviewsFact({ app, count }: { app: PortfolioApp; count: number }) {
  const t = useTranslations("dashboard");
  if (count === 0) return null;
  return (
    <Link href={`/apps/${app.id}/reviews`} className={FACT_LINK}>
      {t("counts.newLowRatings", { count })}
      <ForApp app={app} />
    </Link>
  );
}

export function AppFacts({
  app,
  insight,
  compact = false,
}: {
  app: PortfolioApp;
  insight: PortfolioAppInsight;
  compact?: boolean;
}) {
  return (
    <div
      data-slot="app-facts"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground empty:hidden"
    >
      <RatingFact rating={insight.rating} />
      {compact ? null : <AuditFact audit={insight.audit} />}
      <ActionsFact app={app} actions={insight.actions} />
      <DiscoveriesFact app={app} />
      {compact ? null : (
        <ReviewsFact app={app} count={insight.negativeReviews7d} />
      )}
    </div>
  );
}
