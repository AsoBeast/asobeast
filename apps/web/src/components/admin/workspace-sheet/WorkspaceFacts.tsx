"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import type { SupportWorkspaceSummary } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import { useAppLocale } from "@/lib/use-app-locale";
import { workspaceFacts } from "./workspace-facts";

export function WorkspaceFacts({
  workspace,
}: {
  workspace: SupportWorkspaceSummary;
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  return (
    <SheetSection title={t("support.factsTitle")}>
      <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-dense">
        {workspaceFacts(workspace, { translator: t, locale }).map((fact) => (
          <Fragment key={fact.label}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="wrap-anywhere">{fact.value}</dd>
          </Fragment>
        ))}
      </dl>
      {workspace.suspendedReason ? (
        <figure className="flex flex-col gap-1">
          <figcaption className="text-label text-muted-foreground">
            {t("support.suspendedReason")}
          </figcaption>
          <blockquote
            dir="auto"
            className="border-l-2 border-border pl-3 text-dense wrap-anywhere"
          >
            {workspace.suspendedReason}
          </blockquote>
        </figure>
      ) : null}
    </SheetSection>
  );
}
