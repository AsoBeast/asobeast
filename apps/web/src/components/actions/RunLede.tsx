"use client";

import { Fragment } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { actionActivityScope } from "@/lib/action-filters";
import { formatDateTimeInLocale, formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { actionActivityOptions, actionSummaryFor } from "@/lib/queries";
import { notGeneratedLede, quietRunLede, runChanges } from "./run-lede";

const joiner = (
  index: number,
  count: number,
  t: ReturnType<typeof useTranslations>,
  locale: "en" | "zh-CN",
): string => {
  if (index === 0) return locale === "zh-CN" ? "" : " ";
  return index === count - 1 ? t("joiner.last") : t("joiner.middle");
};

export function RunLede({ appId }: { appId?: string }) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { data: activity } = useSuspenseQuery(
    actionActivityOptions(actionActivityScope(appId)),
  );
  const run = runChanges(summary, activity, t);

  if (run.kind === "unknown") return <span>{notGeneratedLede(t)}</span>;
  if (run.kind === "stale") {
    return <span>{t("staleLede", { count: run.days })}</span>;
  }
  if (run.changes.length === 0) return <span>{quietRunLede(t)}</span>;
  return (
    <>
      <span>{t("onRunDay")}</span>
      {run.changes.map((change, index) => (
        <Fragment key={change}>
          <span>{joiner(index, run.changes.length, t, locale)}</span>
          <span className="font-medium text-foreground">{change}</span>
        </Fragment>
      ))}
      <span>.</span>
    </>
  );
}

export function RunFacts({ appId }: { appId?: string }) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const withheld =
    appId === undefined && summary.generatedAt !== null
      ? summary.suppressedByCap
      : 0;

  return (
    <span data-slot="action-status">
      {summary.generatedAt ? (
        <span>
          <span>{t("generated")}</span>
          <time dateTime={summary.generatedAt}>
            {formatDateTimeInLocale(summary.generatedAt, locale)}
          </time>
        </span>
      ) : (
        <span>{t("notGenerated")}</span>
      )}
      {withheld > 0 ? (
        <>
          <span aria-hidden> · </span>
          <span>
            {t("withheld", { count: formatNumberInLocale(withheld, locale) })}
          </span>
        </>
      ) : null}
    </span>
  );
}
