"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storeConnectionsOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import { connectionSummary, type SummaryPart } from "./connection-summary";

const FIGURE = "numeric font-medium text-foreground";

function Part({ part, locale }: { part: SummaryPart; locale: "en" | "zh-CN" }) {
  if (part.warning) {
    return <span className="font-medium text-warning">{part.text}</span>;
  }
  const figure = part.figure ? (
    <span className={FIGURE}>{part.figure}</span>
  ) : null;
  const space = locale === "zh-CN" ? "" : " ";
  return (
    <span>
      {part.after ? null : figure}
      <span>
        {part.after ? `${part.text}${space}` : `${space}${part.text}`}
      </span>
      {part.after ? figure : null}
    </span>
  );
}

export function IntegrationsStatus() {
  const t = useTranslations("integrations");
  const locale = useAppLocale();
  const { data } = useSuspenseQuery(storeConnectionsOptions);
  const parts = connectionSummary(data, t, locale);
  if (!parts) return null;

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={part.text}>
          {index > 0 ? <span aria-hidden> · </span> : null}
          <Part part={part} locale={locale} />
        </Fragment>
      ))}
    </>
  );
}
