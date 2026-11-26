"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import type {
  CapacityReport,
  SupportWorkspaceSummary,
  ProxyPoolAlert,
  ProxyPoolHealth,
} from "@asobeast/shared";
import { UtilizationMeter } from "@/components/capacity/UtilizationMeter";
import { workspaceListHref } from "@/lib/admin-sections";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import type { MessageTranslator } from "@/i18n/translator";
import { formatNumberInLocale, storeLabel } from "@/lib/format";
import { formatUsdInLocale } from "@/lib/plan-labels";
import {
  adminCapacityOptions,
  adminProxyPoolOptions,
  adminWorkspacesOptions,
} from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import { utilizationPercent, utilizationStatus } from "@/lib/utilization";

const ALERT_KEYS: Record<ProxyPoolAlert, string> = {
  "pool.healthy.low": "capacity.alerts.poolHealthyLow",
  "pool.blocked.rising": "capacity.alerts.poolBlockedRising",
  "pool.silent.rising": "capacity.alerts.poolSilentRising",
  "residential.spend.near-cap": "capacity.alerts.residentialSpendNearCap",
};

function DemandLine({
  label,
  requests,
  capacity,
  utilization,
  meterLabel,
  statusTranslator,
}: {
  label: string;
  requests: number;
  capacity: number;
  utilization: number;
  meterLabel: string;
  statusTranslator: MessageTranslator;
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-dense">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {t("capacity.usage", {
            used: formatNumberInLocale(requests, locale),
            capacity: formatNumberInLocale(capacity, locale),
            percent: formatNumberInLocale(
              utilizationPercent(utilization),
              locale,
            ),
            status: utilizationStatus(utilization, statusTranslator),
          })}
        </span>
      </div>
      <UtilizationMeter label={meterLabel} utilization={utilization} />
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Card role="region" aria-labelledby={id}>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2 id={id}>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
      <CardFooter>{description}</CardFooter>
    </Card>
  );
}

function InstanceDemand({
  report,
  statusTranslator,
}: {
  report: CapacityReport;
  statusTranslator: MessageTranslator;
}) {
  const t = useTranslations("admin");
  return (
    <SectionCard
      title={t("capacity.demandTitle")}
      description={t("capacity.demandDescription")}
    >
      <DemandLine
        label={t("capacity.allStores")}
        requests={report.requestsPerDay}
        capacity={report.capacityPerDay}
        utilization={report.utilization}
        meterLabel={t("capacity.instanceMeter")}
        statusTranslator={statusTranslator}
      />
      {report.stores?.map((store) => (
        <DemandLine
          key={store.store}
          label={storeLabel(store.store)}
          requests={store.requestsPerDay}
          capacity={store.capacityPerDay}
          utilization={store.utilization}
          meterLabel={t("capacity.storeMeter", {
            store: storeLabel(store.store),
          })}
          statusTranslator={statusTranslator}
        />
      ))}
    </SectionCard>
  );
}

function TopConsumers({
  report,
  workspaces,
}: {
  report: CapacityReport;
  workspaces: SupportWorkspaceSummary[];
}) {
  const t = useTranslations("admin");
  const names = new Map(
    workspaces.map((workspace) => [workspace.workspaceId, workspace.name]),
  );
  return (
    <SectionCard
      title={t("capacity.consumersTitle")}
      description={t("capacity.consumersDescription")}
    >
      {report.workspaces.length === 0 ? (
        <p className="text-dense text-muted-foreground">
          {t("capacity.consumersEmpty")}
        </p>
      ) : (
        <ol className="flex flex-col divide-y text-dense">
          {report.workspaces.map((consumer) => (
            <li
              key={consumer.workspaceId}
              className="flex items-baseline justify-between gap-4 py-2"
            >
              <Link
                href={workspaceListHref("apps", consumer.workspaceId)}
                className="min-w-0 truncate font-medium link-underline"
                translate="no"
              >
                {names.get(consumer.workspaceId) ?? consumer.workspaceId}
              </Link>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {t("capacity.requestsPerDay", {
                  count: consumer.requests,
                })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function ProxyPool({ pool }: { pool: ProxyPoolHealth }) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  return (
    <SectionCard
      title={t("capacity.proxyTitle")}
      description={t("capacity.proxyDescription", {
        provider: pool.provider,
      })}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-dense sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t("capacity.provider")}</dt>
          <dd className="font-medium">{pool.provider}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t("capacity.pool")}</dt>
          <dd className="font-medium tabular-nums">
            {t("common.endpointCount", { count: pool.total })}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t("capacity.pending")}</dt>
          <dd className="font-medium tabular-nums">
            {formatNumberInLocale(pool.pending, locale)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">{t("capacity.retired")}</dt>
          <dd className="font-medium tabular-nums">
            {formatNumberInLocale(pool.retired, locale)}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-1 text-dense">
        {pool.stores.map((store) => (
          <li key={store.store} className="flex justify-between gap-4">
            <span>{storeLabel(store.store)}</span>
            <span className="text-muted-foreground tabular-nums">
              {t("capacity.healthy", {
                healthy: formatNumberInLocale(store.healthy, locale),
                total: formatNumberInLocale(store.endpoints, locale),
              })}
            </span>
          </li>
        ))}
        {pool.residential.configured ? (
          <li className="flex justify-between gap-4">
            <span>{t("capacity.residential")}</span>
            <span className="text-muted-foreground tabular-nums">
              {t("capacity.residentialUsage", {
                spend: formatUsdInLocale(pool.residential.spendUsd, locale),
                cap: formatUsdInLocale(pool.residential.capUsd, locale),
              })}
            </span>
          </li>
        ) : null}
      </ul>
      {pool.alerts.map((alert) => (
        <Alert key={alert}>
          <TriangleAlert />
          <AlertDescription>{t(ALERT_KEYS[alert])}</AlertDescription>
        </Alert>
      ))}
      <a
        href="/api/backend/admin/proxy-pool"
        target="_blank"
        rel="noreferrer"
        className="w-fit text-dense font-medium underline underline-offset-4"
      >
        {t("capacity.rawPool")}
        <span className="sr-only"> {t("common.opensInNewTab")}</span>
      </a>
    </SectionCard>
  );
}

export function AdminCapacity() {
  const t = useTranslations("admin");
  const statusTranslator = useTranslations("metrics");
  const { data: report } = useSuspenseQuery(adminCapacityOptions);
  const { data: pool } = useSuspenseQuery(adminProxyPoolOptions);
  const { data: workspaces } = useSuspenseQuery(adminWorkspacesOptions);

  return (
    <div className="flex flex-col gap-6">
      <InstanceDemand report={report} statusTranslator={statusTranslator} />
      <TopConsumers report={report} workspaces={workspaces} />
      {pool.enabled ? <ProxyPool pool={pool} /> : null}
      <p className="text-dense text-muted-foreground">
        {t("capacity.operatorOnly")}
      </p>
    </div>
  );
}
