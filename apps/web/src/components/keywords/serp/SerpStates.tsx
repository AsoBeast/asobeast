import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { SERP_ROW_GRID } from "./SerpRow";
import { SerpSummarySkeleton } from "./SerpSummary";

function Panel({ children }: { children: ReactNode }) {
  return (
    <p className="mx-4 mt-4 p-6 text-center text-body text-muted-foreground">
      {children}
    </p>
  );
}

export function SerpNeverChecked() {
  const t = useTranslations("keywordInspector");
  return <Panel>{t("serp.states.neverChecked")}</Panel>;
}

export function SerpNothingCaptured({ date }: { date: string }) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  return (
    <Panel>
      {t("serp.states.nothingCaptured", {
        date: formatDateInLocale(date, locale),
      })}
    </Panel>
  );
}

export function SerpNoApps({ date }: { date: string }) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  return (
    <Panel>
      {t("serp.states.noApps", {
        date: formatDateInLocale(date, locale),
      })}
    </Panel>
  );
}

export function SerpKeptShort() {
  const t = useTranslations("keywordInspector");
  return (
    <p className="px-4 pt-3 text-caption text-muted-foreground">
      {t("serp.keptShort")}
    </p>
  );
}

export function SerpSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <SerpSummarySkeleton />
      <div className="px-4 pt-4 pb-1 text-label">
        <Skeleton className="h-lh w-12" />
      </div>
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} data-slot="serp-row" className={SERP_ROW_GRID}>
          <Skeleton className="col-start-1 row-start-1 ml-auto h-5 w-5" />
          <Skeleton className="col-start-2 row-start-1 size-10 rounded-lg" />
          <div className="col-start-3 row-start-1 flex flex-col gap-0.5">
            <Skeleton className="h-lh w-3/4" />
            <Skeleton className="h-lh w-1/3 text-caption" />
          </div>
          <Skeleton className="col-start-4 row-start-1 h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
