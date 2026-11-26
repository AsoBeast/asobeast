import type { SerpSnapshot, Store } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { CapturedDayPicker } from "@/components/day-picker/CapturedDayPicker";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCountryInLocale,
  formatDayMonthInLocale,
  storeLabel,
} from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { exportSerp, type SerpViewer } from "./serp-csv";

function comparisonCaption(
  comparedTo: string | null | undefined,
  t: MessageTranslator,
  locale: Locale,
) {
  return comparedTo
    ? t("serp.header.comparison", {
        date: formatDayMonthInLocale(comparedTo, locale),
      })
    : t("serp.header.noEarlier");
}

function SerpToolbar({
  snapshot,
  loading,
  viewer,
  exportable,
  onSelectDay,
}: {
  snapshot: SerpSnapshot | undefined;
  loading: boolean;
  viewer: SerpViewer;
  exportable: boolean;
  onSelectDay: (date: string) => void;
}) {
  const dates = snapshot?.dates ?? [];
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {loading ? <Skeleton aria-hidden className="h-9 w-60" /> : null}
      {snapshot?.date && dates.length > 0 ? (
        <>
          <CapturedDayPicker
            dates={dates}
            value={snapshot.date}
            onSelect={onSelectDay}
          />
          <span className="text-caption text-muted-foreground">
            {comparisonCaption(snapshot.comparedTo, t, locale)}
          </span>
        </>
      ) : null}
      <ExportCsvButton
        subject={t("serp.header.exportSubject")}
        className="ml-auto"
        disabled={
          !exportable ||
          !snapshot ||
          snapshot.entries.length === 0 ||
          viewer.storeAppId === undefined
        }
        onClick={() => {
          if (snapshot) exportSerp(viewer, snapshot);
        }}
      />
    </div>
  );
}

export function SerpHeader({
  text,
  country,
  store,
  snapshot,
  loading,
  viewer,
  exportable,
  onSelectDay,
}: {
  text: string | undefined;
  country: string | undefined;
  store: Store;
  snapshot: SerpSnapshot | undefined;
  loading: boolean;
  viewer: SerpViewer;
  exportable: boolean;
  onSelectDay: (date: string) => void;
}) {
  const locale = useAppLocale();
  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        {text ? (
          <p translate="no" dir="auto" className="text-heading wrap-anywhere">
            {text}
          </p>
        ) : null}
        {country ? (
          <p className="text-caption text-muted-foreground">
            {`${formatCountryInLocale(country, locale)}, ${storeLabel(store)}`}
          </p>
        ) : null}
      </div>
      <SerpToolbar
        snapshot={snapshot}
        loading={loading}
        viewer={viewer}
        exportable={exportable}
        onSelectDay={onSelectDay}
      />
    </div>
  );
}
