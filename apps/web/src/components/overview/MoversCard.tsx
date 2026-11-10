"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { byMagnitude } from "@/components/dashboard/mover-change";
import {
  PANEL_ACTION,
  PANEL_HEADER,
} from "@/components/dashboard/layout-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { appDetailOptions, appSummaryOptions } from "@/lib/queries";
import {
  MOVER_VIEWS,
  moverViewParser,
  type MoverView,
} from "@/lib/search-params";
import { GapHeadline } from "./GapHeadline";
import { MoverRows } from "./MoverRows";

const ALL_MOVERS = 8;

const MOVER_LABELS: Record<MoverView, string> = {
  all: "All",
  up: "Climbers",
  down: "Fallers",
};

const EMPTY: Record<MoverView, string> = {
  all: "No keyword moved in the last 7 days.",
  up: "No keyword climbed in the last 7 days.",
  down: "No keyword fell in the last 7 days.",
};

export function MoversCard({ id }: { id: string }) {
  const { country } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const [view, setView] = useQueryState("movers", moverViewParser);
  const { up, down } = summary.movers;
  const shown = {
    all: byMagnitude([...up, ...down]).slice(0, ALL_MOVERS),
    up,
    down,
  }[view];
  const quiet = up.length + down.length === 0;

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
        <MoverRows
          id={id}
          movers={shown}
          empty={quiet ? EMPTY.all : EMPTY[view]}
        />
      </CardContent>
      {app.isCompetitor ? null : (
        <CardFooter>
          <GapHeadline id={id} home={app.country} />
        </CardFooter>
      )}
    </Card>
  );
}
