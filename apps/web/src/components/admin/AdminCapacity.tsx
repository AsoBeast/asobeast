"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, formatUsd, pluralize, storeLabel } from "@/lib/format";
import {
  adminCapacityOptions,
  adminProxyPoolOptions,
  adminWorkspacesOptions,
} from "@/lib/queries";
import { utilizationPercent, utilizationStatus } from "@/lib/utilization";

const ALERT_COPY: Record<ProxyPoolAlert, string> = {
  "pool.healthy.low":
    "Few healthy endpoints remain, so store work may slow until the pool recovers.",
  "pool.blocked.rising":
    "Blocked responses are rising, so the stores may be refusing pool addresses.",
  "pool.silent.rising":
    "Silent failures are rising: responses arrive empty, which points at a block or a parser change.",
  "residential.spend.near-cap":
    "Residential fallback spend is close to its monthly cap.",
};

function DemandLine({
  label,
  requests,
  capacity,
  utilization,
  meterLabel,
}: {
  label: string;
  requests: number;
  capacity: number;
  utilization: number;
  meterLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {formatNumber(requests)} of {formatNumber(capacity)} requests/day ·{" "}
          {utilizationPercent(utilization)}% · {utilizationStatus(utilization)}
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
      <CardHeader>
        <CardTitle asChild>
          <h2 id={id}>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function InstanceDemand({ report }: { report: CapacityReport }) {
  return (
    <SectionCard
      title="Instance demand"
      description="Store requests the daily run enqueues for every workspace it visits, against the capacity of this instance. Suspended and unentitled workspaces are skipped."
    >
      <DemandLine
        label="All stores"
        requests={report.requestsPerDay}
        capacity={report.capacityPerDay}
        utilization={report.utilization}
        meterLabel="Instance daily request utilization"
      />
      {report.stores?.map((store) => (
        <DemandLine
          key={store.store}
          label={storeLabel(store.store)}
          requests={store.requestsPerDay}
          capacity={store.capacityPerDay}
          utilization={store.utilization}
          meterLabel={`${storeLabel(store.store)} daily request utilization`}
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
  const names = new Map(
    workspaces.map((workspace) => [workspace.workspaceId, workspace.name]),
  );
  return (
    <SectionCard
      title="Top consumers"
      description="The workspaces whose tracking costs the most requests per day."
    >
      {report.workspaces.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workspace is tracking anything yet.
        </p>
      ) : (
        <ol className="flex flex-col divide-y text-sm">
          {report.workspaces.map((consumer) => (
            <li
              key={consumer.workspaceId}
              className="flex items-baseline justify-between gap-4 py-2"
            >
              <Link
                href={workspaceListHref("apps", consumer.workspaceId)}
                className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
                translate="no"
              >
                {names.get(consumer.workspaceId) ?? consumer.workspaceId}
              </Link>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatNumber(consumer.requests)} requests/day
              </span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function ProxyPool({ pool }: { pool: ProxyPoolHealth }) {
  return (
    <SectionCard
      title="Proxy pool"
      description={`Store requests leave through ${pool.provider} endpoints instead of the host address.`}
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Provider</dt>
          <dd className="font-medium">{pool.provider}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Pool</dt>
          <dd className="font-medium tabular-nums">
            {pluralize(pool.total, "endpoint")}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Pending</dt>
          <dd className="font-medium tabular-nums">
            {formatNumber(pool.pending)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground">Retired</dt>
          <dd className="font-medium tabular-nums">
            {formatNumber(pool.retired)}
          </dd>
        </div>
      </dl>
      <ul className="flex flex-col gap-1 text-sm">
        {pool.stores.map((store) => (
          <li key={store.store} className="flex justify-between gap-4">
            <span>{storeLabel(store.store)}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatNumber(store.healthy)} of {formatNumber(store.endpoints)}{" "}
              healthy
            </span>
          </li>
        ))}
        {pool.residential.configured ? (
          <li className="flex justify-between gap-4">
            <span>Residential fallback this month</span>
            <span className="text-muted-foreground tabular-nums">
              {formatUsd(pool.residential.spendUsd)} of{" "}
              {formatUsd(pool.residential.capUsd)}
            </span>
          </li>
        ) : null}
      </ul>
      {pool.alerts.map((alert) => (
        <Alert key={alert}>
          <TriangleAlert />
          <AlertDescription>{ALERT_COPY[alert]}</AlertDescription>
        </Alert>
      ))}
      <a
        href="/api/backend/admin/proxy-pool"
        target="_blank"
        rel="noreferrer"
        className="w-fit text-sm font-medium underline underline-offset-4"
      >
        Raw pool health
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </SectionCard>
  );
}

export function AdminCapacity() {
  const { data: report } = useSuspenseQuery(adminCapacityOptions);
  const { data: pool } = useSuspenseQuery(adminProxyPoolOptions);
  const { data: workspaces } = useSuspenseQuery(adminWorkspacesOptions);

  return (
    <div className="flex flex-col gap-6">
      <InstanceDemand report={report} />
      <TopConsumers report={report} workspaces={workspaces} />
      {pool.enabled ? <ProxyPool pool={pool} /> : null}
      <p className="text-sm text-muted-foreground">
        Each workspace sees only its own plan usage. Capacity is shown to the
        platform operator only.
      </p>
    </div>
  );
}
