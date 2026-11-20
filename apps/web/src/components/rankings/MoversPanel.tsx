"use client";

import type { ReactNode } from "react";
import { useQueryState } from "nuqs";
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
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const MOVER_LABELS: Record<MoverView, string> = {
  all: "All",
  up: "Climbers",
  down: "Fallers",
};

const EMPTY: Record<MoverView, (period: MoverPeriod) => string> = {
  all: ({ span }) => `No keyword moved ${span}.`,
  up: ({ span }) => `No keyword climbed ${span}.`,
  down: ({ span }) => `No keyword fell ${span}.`,
};

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
  const [view, setView] = useQueryState("movers", moverViewParser);
  const shown = {
    all: byMagnitude([...up, ...down]).slice(0, ALL_MOVERS),
    up,
    down,
  }[view];

  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Keyword movers</h2>
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
                <TabsList aria-label="Movers shown" className="print:hidden">
                  {MOVER_VIEWS.map((value) => (
                    <TabsOption key={value} value={value}>
                      <span>{MOVER_LABELS[value]}</span>
                      {counts ? (
                        <span className="numeric text-muted-foreground max-[359px]:hidden">
                          {formatNumber(counts[value])}
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
            empty={EMPTY[view](period)}
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
