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
import { byMagnitude } from "./mover-change";

const ALL_MOVERS = 8;

const MOVER_LABELS: Record<MoverView, string> = {
  all: "All",
  up: "Climbers",
  down: "Fallers",
};

const EMPTY: Record<MoverView, (days: number) => string> = {
  all: (days) => `No keyword moved in the last ${days} days.`,
  up: (days) => `No keyword climbed in the last ${days} days.`,
  down: (days) => `No keyword fell in the last ${days} days.`,
};

export function MoversPanel<Mover extends KeywordMover>({
  movers: { up, down },
  days,
  quiet,
  changeHeading,
  hrefOf,
  lead,
  footer,
}: {
  movers: { up: Mover[]; down: Mover[] };
  days: number;
  quiet: string | null;
  changeHeading?: string;
  hrefOf: (mover: Mover) => string;
  lead: (mover: Mover) => ReactNode;
  footer?: ReactNode;
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
        {quiet ? null : (
          <CardAction className={PANEL_ACTION}>
            <Tabs
              value={view}
              onValueChange={(next) =>
                void setView(moverViewParser.parse(next))
              }
            >
              <TabsList aria-label="Movers shown" className="print:hidden">
                {MOVER_VIEWS.map((value) => (
                  <TabsOption key={value} value={value}>
                    {MOVER_LABELS[value]}
                  </TabsOption>
                ))}
              </TabsList>
            </Tabs>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1 px-2">
        {quiet ? (
          <p className="px-2 text-body text-muted-foreground">{quiet}</p>
        ) : (
          <MoverList
            movers={shown}
            days={days}
            empty={EMPTY[view](days)}
            changeHeading={changeHeading}
            hrefOf={hrefOf}
            lead={lead}
          />
        )}
      </CardContent>
      {footer ? <CardFooter>{footer}</CardFooter> : null}
    </Card>
  );
}
