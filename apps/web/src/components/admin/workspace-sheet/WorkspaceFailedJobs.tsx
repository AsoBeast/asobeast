"use client";

import { useTranslations } from "next-intl";
import type { SupportFailedJob } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import { queueLabel } from "@/lib/admin-support";
import { formatDateTimeInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { Locale } from "@/lib/locale";
import { SectionEmpty, SectionNote } from "./SectionNote";

function failedWhen(
  job: SupportFailedJob,
  t: ReturnType<typeof useTranslations>,
  locale: Locale,
): string {
  return job.failedAt
    ? formatDateTimeInLocale(job.failedAt, locale)
    : t("support.failedJobs.timeUnknown");
}

export function WorkspaceFailedJobs({
  jobs,
  unavailable,
}: {
  jobs: SupportFailedJob[];
  unavailable: boolean;
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  return (
    <SheetSection title={t("support.failedJobs.title")}>
      {jobs.length === 0 ? (
        <SectionEmpty>
          {t(
            unavailable
              ? "support.failedJobs.unavailable"
              : "support.failedJobs.empty",
          )}
        </SectionEmpty>
      ) : (
        <ul
          aria-label={t("support.failedJobs.title")}
          className="flex flex-col divide-y divide-border-subtle"
        >
          {jobs.map((job) => (
            <li
              key={`${job.queue}-${job.id}`}
              className="flex flex-col gap-1 py-2 text-dense"
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span translate="no" className="font-mono text-caption">
                  {job.name}
                </span>
                <span className="text-muted-foreground">
                  {t("support.failedJobs.item", {
                    queue: queueLabel(job.queue, t),
                    attempts: t("common.attemptCount", {
                      count: job.attempts,
                    }),
                    time: failedWhen(job, t, locale),
                  })}
                </span>
              </div>
              <p className="text-caption wrap-anywhere text-muted-foreground">
                {job.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
      <SectionNote>{t("support.failedJobs.note")}</SectionNote>
    </SheetSection>
  );
}
