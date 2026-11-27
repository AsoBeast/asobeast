"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  FOOTER_LINK,
  PANEL_COUNT,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function NoOpenActions({ generated }: { generated: boolean }) {
  const t = useTranslations("actions");
  return (
    <EmptyState
      title={generated ? t("doNext.emptyGenerated") : t("doNext.emptyNever")}
    />
  );
}

export function DoNextPanel({
  counts,
  href,
  className,
  children,
}: {
  counts: string | null;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("actions");
  return (
    <Card className={className}>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>{t("doNext.title")}</h2>
        </CardTitle>
        {counts ? (
          <CardAction className={PANEL_COUNT}>{counts}</CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 px-2">{children}</CardContent>
      <CardFooter className="justify-between">
        <span>{t("rulesOverHistory")}</span>
        <Link href={href} className={FOOTER_LINK}>
          {t("doNext.openCenter")}
        </Link>
      </CardFooter>
    </Card>
  );
}
