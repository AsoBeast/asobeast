"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { AdminOverview } from "@asobeast/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { countOf } from "@/lib/admin-stages";
import { formatNumberInLocale } from "@/lib/format";
import { adminOverviewOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";

function formatReadClock(value: string, locale: Locale): string {
  return `${new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))} UTC`;
}

function instanceFacts(
  overview: AdminOverview,
  t: MessageTranslator,
  locale: Locale,
): string {
  const workspaces = t("common.workspaceCount", {
    count: overview.workspaces.total,
  });
  const read = t("header.read", {
    time: formatReadClock(overview.generatedAt, locale),
  });
  return overview.billing
    ? t("header.billingMeta", {
        workspaces,
        trialing: formatNumberInLocale(
          countOf(overview.workspaces.byStage, "trialing"),
          locale,
        ),
        paying: formatNumberInLocale(
          countOf(overview.workspaces.byStage, "paying"),
          locale,
        ),
        read,
      })
    : t("header.selfHostedMeta", {
        workspaces,
        accounts: t("common.accountCount", { count: overview.users.total }),
        read,
      });
}

export function AdminHeader() {
  const { data: overview } = useQuery(adminOverviewOptions);
  const t = useTranslations("admin");
  const locale = useAppLocale();

  return (
    <PageHeader
      title={t("title")}
      meta={overview ? instanceFacts(overview, t, locale) : undefined}
    />
  );
}
