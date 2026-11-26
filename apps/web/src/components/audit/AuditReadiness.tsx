"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type {
  AppAuditResult,
  ReadinessItem,
  ReadinessLink,
  ReadinessStatus,
} from "@asobeast/shared";
import { isoDateOrNull } from "@asobeast/shared";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  TriangleAlert,
} from "lucide-react";
import { PANEL_COUNT, PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDayMonthInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { cn } from "@/lib/utils";
import {
  auditReadinessLabel,
  auditReadinessLinkLabel,
  auditText,
} from "./audit-content-zh";

const STATUS_ICON: Record<ReadinessStatus, typeof CircleCheck> = {
  pass: CircleCheck,
  warn: TriangleAlert,
  fail: CircleX,
  unmeasurable: CircleDashed,
};

const STATUS_TONE: Record<ReadinessStatus, string> = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
  unmeasurable: "text-muted-foreground",
};

function ReadinessLinkView({
  link,
  subject,
}: {
  link: ReadinessLink;
  subject: string;
}) {
  const locale = useAppLocale();
  const label = auditReadinessLinkLabel(link.href, link.label, locale);
  if (link.href.startsWith("https://")) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        className="w-fit text-foreground link-underline"
      >
        <span>{label}</span>
      </a>
    );
  }
  return (
    <Link href={link.href} className="w-fit text-foreground link-underline">
      <span>{label}</span>
      <span className="sr-only">{`, ${subject}`}</span>
    </Link>
  );
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  const Icon = STATUS_ICON[item.status];
  const label = auditReadinessLabel(item.id, item.label, locale);
  return (
    <li className="flex items-start gap-2 px-2 py-2 text-dense">
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", STATUS_TONE[item.status])}
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-x-3">
          <span className="min-w-0 font-medium wrap-anywhere">
            <span>{label}</span>
          </span>
          <span className="shrink-0 text-caption text-muted-foreground">
            <span>{t(`readiness.${item.status}`)}</span>
          </span>
        </p>
        {item.detail === null ? null : (
          <p className="text-caption text-muted-foreground">
            <span>
              {item.detail === null ? null : auditText(item.detail, locale)}
            </span>
          </p>
        )}
        {item.link === null ? null : (
          <ReadinessLinkView link={item.link} subject={label} />
        )}
      </div>
    </li>
  );
}

function editorialLine(
  readiness: NonNullable<AppAuditResult["readiness"]>,
  t: MessageTranslator,
  locale: Locale,
) {
  const editorial = readiness.editorial;
  if (editorial === null) {
    return t("readiness.notRead");
  }
  const stories =
    editorial.stories === 0
      ? t("readiness.noStories")
      : t("featuredStories", { count: editorial.stories });
  const day = isoDateOrNull(readiness.extractAsOf);
  return [
    editorial.editorsChoiceBadge
      ? `${stories} · ${t("editorsBadge")}`
      : stories,
    day === null
      ? null
      : t("pageRead", { date: formatDayMonthInLocale(day, locale) }),
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

export function AuditReadiness({ audit }: { audit: AppAuditResult }) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  const headingId = useId();
  const readiness = audit.readiness;
  if (audit.store !== "APP_STORE" || readiness === undefined) {
    return null;
  }
  const passes = readiness.items.filter(
    (item) => item.status === "pass",
  ).length;

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>{t("readiness.title")}</h2>
          </CardTitle>
          <CardAction className={cn(PANEL_COUNT, "numeric")}>
            {t("readinessPass", {
              pass: passes,
              total: readiness.items.length,
            })}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col px-2">
          <ul className="flex list-none flex-col p-0">
            {readiness.items.map((item) => (
              <ReadinessRow key={item.id} item={item} />
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <span>{editorialLine(readiness, t, locale)}</span>
        </CardFooter>
      </Card>
    </section>
  );
}
