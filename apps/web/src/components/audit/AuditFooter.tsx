"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AppAuditResult } from "@asobeast/shared";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { percent } from "./audit-copy";
import { auditLimitation } from "./audit-content-zh";

function computedLine(
  audit: AppAuditResult,
  t: MessageTranslator,
  locale: Locale,
): string {
  return [
    t("computed", { date: formatDateInLocale(audit.generatedAt, locale) }),
    ...(audit.rubricVersion
      ? [t("rubric", { version: audit.rubricVersion })]
      : []),
    ...(audit.confidence === undefined
      ? []
      : [t("measuredShort", { percent: percent(audit.confidence) })]),
  ].join(" · ");
}

export function AuditFooter({ audit }: { audit: AppAuditResult }) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  const limitations = audit.limitations ?? [];

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption text-faint-foreground">
        {computedLine(audit, t, locale)}
      </p>
      {limitations.length === 0 ? null : (
        <details className="group">
          <summary className="inline-flex list-none items-center gap-1.5 rounded-sm text-dense font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden
              className="size-4 text-muted-foreground transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
            />
            <span>{t("footer.title")}</span>
          </summary>
          <ul className="mt-2.5 flex max-w-[70ch] list-none flex-col gap-2 p-0 text-dense text-muted-foreground">
            {limitations.map((limitation) => {
              const copy = auditLimitation(limitation, locale);
              return (
                <li key={limitation.id}>
                  <span className="font-medium text-foreground">
                    {`${copy.label}. `}
                  </span>
                  <span>{copy.detail}</span>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
