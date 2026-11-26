import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PortfolioApp, PortfolioAppInsight } from "@asobeast/shared";
import { RankBandBar } from "@/components/charts/RankBandBar";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Separated } from "@/components/ui/separated";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatNumberInLocale,
  storeLabel,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { AppCardLink } from "@/components/apps/AppCardLink";
import { DelistedBadge } from "@/components/apps/DelistedBadge";
import { DeleteAppMenu } from "@/components/apps/DeleteAppMenu";
import { AppFacts } from "./AppFacts";
import { setupChipText } from "./setup-chip";
import { Sparkline } from "@/components/charts/Sparkline";

export function AppStats({ app }: { app: PortfolioApp }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
      <span>{t("counts.keywords", { count: app.trackedKeywords })}</span>
      <span>{t("counts.competitors", { count: app.competitors })}</span>
      <span>
        {t("cards.updated", {
          date: formatDateInLocale(app.lastCapturedAt, locale),
        })}
      </span>
    </div>
  );
}

export function AppBadges({ app }: { app: PortfolioApp }) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  const setup = setupChipText(app.setup, t);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label text-muted-foreground">
      <span>
        <Separated
          parts={[
            storeLabel(app.store),
            <span
              key="country"
              title={t("cards.homeStorefront", {
                country: formatCountryInLocale(app.country, locale),
              })}
            >
              {app.country.toUpperCase()}
            </span>,
          ]}
        />
      </span>
      {app.delistedAt ? <DelistedBadge since={app.delistedAt} /> : null}
      {setup ? (
        <Badge variant="info" asChild className="relative z-20 min-h-6 w-fit">
          <Link href={`/apps/${app.id}/setup`}>{setup}</Link>
        </Badge>
      ) : null}
    </div>
  );
}

function Top10Line({ insight }: { insight: PortfolioAppInsight }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-1">
      <RankBandBar distribution={insight.rankDistribution} />
      <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
        <span>
          {t("cards.top10", {
            count: insight.rankDistribution.top10,
          })}
        </span>
        <TrendChip
          label={t("table.rangeUnit", { days: 7 })}
          value={insight.top10Delta7d}
        />
      </div>
    </div>
  );
}

const hasTrackedKeywords = (insight: PortfolioAppInsight): boolean =>
  Object.values(insight.rankDistribution).some((count) => count > 0);

export function PortfolioAppCard({
  app,
  insight,
}: {
  app: PortfolioApp;
  insight: PortfolioAppInsight | undefined;
}) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  const name = app.name ?? t("table.untitled");

  return (
    <Card className="@container/app-card relative h-full gap-0 p-4 transition-colors hover:bg-muted">
      <AppCardLink
        id={app.id}
        name={name}
        className="absolute inset-0 z-10 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />

      <div className="absolute top-2 right-2 z-20">
        <DeleteAppMenu id={app.id} name={name} />
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-4">
          <AppIcon src={app.iconUrl} />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
            <span title={name} className="truncate font-medium">
              {name}
            </span>
            <AppBadges app={app} />
          </div>
        </div>

        {app.lastCapturedAt === null ? (
          <p className="text-body text-muted-foreground">
            {t("cards.collecting")}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="numeric text-metric">
                  {formatNumberInLocale(
                    Math.round(app.visibility.current),
                    locale,
                  )}
                </span>
                <TrendChip
                  label={t("table.rangeUnit", { days: 7 })}
                  value={app.visibility.delta7d}
                />
              </div>
              <span className="text-caption text-muted-foreground">
                {t("cards.visibility")}
              </span>
            </div>

            <Sparkline points={app.sparkline} />

            {insight && hasTrackedKeywords(insight) ? (
              <Top10Line insight={insight} />
            ) : null}
            {insight ? <AppFacts app={app} insight={insight} /> : null}
          </>
        )}

        <div data-slot="app-card-footer" className="mt-auto">
          <AppStats app={app} />
        </div>
      </div>
    </Card>
  );
}

export function PortfolioGroupMember({
  app,
  insight,
}: {
  app: PortfolioApp;
  insight: PortfolioAppInsight | undefined;
}) {
  const t = useTranslations("dashboard");
  const locale = useAppLocale();
  const name = app.name ?? t("table.untitled");

  return (
    <div className="relative flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <AppCardLink
        id={app.id}
        name={name}
        className="absolute inset-0 z-10 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />

      <div className="absolute top-2 right-0 z-20">
        <DeleteAppMenu id={app.id} name={name} />
      </div>

      <div className="flex items-center gap-3 pr-6">
        <AppIcon src={app.iconUrl} size={36} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span title={name} className="truncate text-body font-medium">
            {name}
          </span>
          <AppBadges app={app} />
        </div>
        {app.lastCapturedAt === null ? null : (
          <div className="flex flex-col items-end gap-1">
            <span className="numeric text-title">
              {formatNumberInLocale(Math.round(app.visibility.current), locale)}
            </span>
            <TrendChip
              label={t("table.rangeUnit", { days: 7 })}
              value={app.visibility.delta7d}
            />
          </div>
        )}
      </div>

      {app.lastCapturedAt === null ? (
        <p className="text-caption text-muted-foreground">
          {t("cards.collectingShort")}
        </p>
      ) : (
        <>
          <Sparkline points={app.sparkline} />
          {insight ? <AppFacts app={app} insight={insight} compact /> : null}
        </>
      )}

      <AppStats app={app} />
    </div>
  );
}
