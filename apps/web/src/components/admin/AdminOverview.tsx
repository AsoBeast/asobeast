"use client";

import { useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminConversionOptions, adminOverviewOptions } from "@/lib/queries";
import { adminOverviewParsers } from "@/lib/search-params";
import { OverviewStrip } from "./OverviewStrip";
import { OVERVIEW_COLUMNS } from "./overview-layout";
import { SignupsChart } from "./SignupsChart";
import {
  DeparturesPanel,
  FunnelPanel,
  InstancePanel,
  NeedsALookPanel,
  PayingPanel,
  StagesPanel,
  WindowSegment,
} from "./overview-panels";

export function AdminOverview() {
  const t = useTranslations("admin");
  const [{ days }, setView] = useQueryStates(adminOverviewParsers);
  const shownDays = useDeferredValue(days);
  const { data: overview } = useSuspenseQuery(adminOverviewOptions);
  const { data: conversion } = useSuspenseQuery(
    adminConversionOptions(shownDays),
  );

  return (
    <div className="@container/admin-overview flex flex-col gap-6">
      <OverviewStrip overview={overview} conversion={conversion} />
      <div className={OVERVIEW_COLUMNS}>
        <div className="flex min-w-0 flex-col gap-6">
          <FunnelPanel
            conversion={conversion}
            segment={
              <WindowSegment
                days={days}
                onChange={(next) => void setView({ days: next })}
              />
            }
          />
          <Card className="min-w-0">
            <CardHeader className={PANEL_HEADER}>
              <CardTitle asChild>
                <h2>{t("overview.signupsTitle")}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SignupsChart signups={overview.signups} />
            </CardContent>
            <CardFooter>
              {t("overview.signupsFooter", {
                count: overview.users.joinedLast30Days,
              })}
            </CardFooter>
          </Card>
          <DeparturesPanel conversion={conversion} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <NeedsALookPanel overview={overview} conversion={conversion} />
          {overview.billing ? <StagesPanel overview={overview} /> : null}
          {overview.billing && overview.workspaces.payingByPlan ? (
            <PayingPanel payingByPlan={overview.workspaces.payingByPlan} />
          ) : null}
          <InstancePanel overview={overview} />
        </div>
      </div>
    </div>
  );
}
