"use client";

import type { ReactNode } from "react";
import { useQueryState } from "nuqs";
import { useTranslations } from "next-intl";
import type { KeywordMover } from "@asobeast/shared";
import { PANEL_ACTION, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  MOVER_VIEWS,
  moverViewParser,
  type MoverView,
} from "@/lib/search-params";
import { MoverList } from "./MoverList";
import { byMagnitude, type MoverPeriod } from "./mover-change";
import { formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const ALL_MOVERS = 8;

export function MoversPanel<Mover extends KeywordMover>({
  movers: { up, down },
  period,
  quiet,
  counts,
  control,
  changeHeading,
  hrefOf,
  lead,
  footer,
  children,
}: {
  movers: { up: Mover[]; down: Mover[] };
  period: MoverPeriod;
  quiet: string | null;
  counts?: Record<MoverView, number>;
  control?: ReactNode;
  changeHeading?: string;
  hrefOf: (mover: Mover) => string;
  lead: (mover: Mover) => ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const t = useTranslations("rankings");
  const locale = useAppLocale();
  const [view, setView] = useQueryState("movers", moverViewParser);
  const shown = {
    all: byMagnitude([...up, ...down]).slice(0, ALL_MOVERS),
    up,
    down,
  }[view];
  const labels: Record<MoverView, string> = {
    all: t("all"),
    up: t("climbers"),
    down: t("fallers"),
  };
  const empty =
    view === "all"
      ? t("noMover", { span: period.span })
      : view === "up"
        ? t("noClimber", { span: period.span })
        : t("noFall", { span: period.span });

  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{t("moversTitle")}</h2>
        </CardTitle>
        {quiet && !control ? null : (
          <CardAction
            className={cn(PANEL_ACTION, "flex flex-wrap items-center gap-2")}
          >
            {control}
            {quiet ? null : (
              <Tabs
                value={view}
                onValueChange={(next) =>
                  void setView(moverViewParser.parse(next))
                }
              >
                <TabsList
                  aria-label={t("moversShown")}
                  className="print:hidden"
                >
                  {MOVER_VIEWS.map((value) => (
                    <TabsOption key={value} value={value}>
                      <span>{labels[value]}</span>
                      {counts ? (
                        <span className="numeric text-muted-foreground max-[359px]:hidden">
                          {formatNumberInLocale(counts[value], locale)}
                        </span>
                      ) : null}
                    </TabsOption>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-2">
        {quiet ? (
          <EmptyState title={quiet} />
        ) : (
          <MoverList
            movers={shown}
            period={period}
            empty={empty}
            changeHeading={changeHeading}
            hrefOf={hrefOf}
            lead={lead}
          />
        )}
        {children}
      </CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
