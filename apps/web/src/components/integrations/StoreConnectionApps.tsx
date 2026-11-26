"use client";

import type { Store, StoreConnectionApp } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { PanelSubhead } from "@/components/settings/PanelSubhead";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  appStateLabel,
  historyLine,
  storeConsoleCopy,
} from "@/lib/store-connection-copy";
import { cn } from "@/lib/utils";
import {
  coverageScale,
  coverageSpan,
  endsOnSync,
  type CoverageScale,
} from "./data-coverage";

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_max-content] gap-x-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_9rem]";

const NEEDS_ACTION = new Set(["forbidden", "stopped"]);

function AppRow({
  store,
  app,
  scale,
}: {
  store: Store;
  app: StoreConnectionApp;
  scale: CoverageScale | null;
}) {
  const t = useTranslations("integrations");
  const locale = useAppLocale();
  const span = coverageSpan(app, scale);

  return (
    <li
      className={cn(
        COLUMNS,
        "min-h-11 items-center gap-y-2 px-(--card-spacing) py-2",
      )}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-dense font-medium">
          {app.name ?? app.appId}
        </span>
        <span
          className={cn(
            "text-caption",
            app.state && NEEDS_ACTION.has(app.state)
              ? "text-warning"
              : "text-faint-foreground",
          )}
        >
          {appStateLabel(app.state, store, t)}
        </span>
      </div>
      <div
        role="img"
        aria-label={historyLine(app, t, locale)}
        className="relative col-span-full row-start-2 h-1.5 rounded-full bg-muted sm:col-span-1 sm:row-start-auto"
      >
        {span ? (
          <span
            className="absolute inset-y-0 rounded-full"
            style={{
              insetInlineStart: `${span.left}%`,
              inlineSize: `${span.width}%`,
              background: "var(--brand-mark)",
            }}
          />
        ) : null}
      </div>
      {span && app.lastDate ? (
        <div className="numeric flex flex-col text-right">
          <span className="text-dense font-medium">
            {t("storeConnections.dayCount", { count: span.days })}
          </span>
          <span className="text-caption text-faint-foreground">
            {t("storeConnections.through", {
              date: formatDateInLocale(app.lastDate, locale),
            })}
          </span>
        </div>
      ) : (
        <span className="text-right text-caption text-faint-foreground">
          {t("storeConnections.noData")}
        </span>
      )}
    </li>
  );
}

export function StoreConnectionApps({
  store,
  apps,
  lastSyncedAt,
}: {
  store: Store;
  apps: StoreConnectionApp[];
  lastSyncedAt: string | null;
}) {
  const t = useTranslations("integrations");
  const locale = useAppLocale();
  const copy = storeConsoleCopy(store, t, locale);
  if (apps.length === 0) {
    return (
      <p className="border-t px-(--card-spacing) py-3 text-body text-muted-foreground">
        {copy.noApps}
      </p>
    );
  }
  const scale = coverageScale(apps, lastSyncedAt);

  return (
    <>
      <PanelSubhead
        as="p"
        title={copy.appsLabel}
        count={apps.length}
        note={t("storeConnections.firstNewest")}
      />
      <ul aria-label={copy.appsLabel} className="flex flex-col py-1">
        {apps.map((app) => (
          <AppRow key={app.appId} store={store} app={app} scale={scale} />
        ))}
      </ul>
      {scale ? (
        <div
          aria-hidden
          className={cn(
            COLUMNS,
            "hidden px-(--card-spacing) pb-3 text-tick text-faint-foreground sm:grid",
          )}
        >
          <div className="col-start-2 flex justify-between gap-2">
            <span>{formatDateInLocale(scale.from, locale)}</span>
            <span>{`${endsOnSync(scale, lastSyncedAt) ? t("storeConnections.lastSync") : t("storeConnections.newestReport")}, ${formatDateInLocale(scale.to, locale)}`}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}
