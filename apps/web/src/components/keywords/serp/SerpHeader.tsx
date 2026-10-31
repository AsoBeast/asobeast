import type { SerpSnapshot, Store } from "@asobeast/shared";
import { CapturedDayPicker } from "@/components/day-picker/CapturedDayPicker";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCountry, formatDayMonth, storeLabel } from "@/lib/format";
import { exportSerp, type SerpViewer } from "./serp-csv";

function comparisonCaption(comparedTo: string | null | undefined) {
  return comparedTo ? `vs ${formatDayMonth(comparedTo)}` : "No earlier capture";
}

function SerpToolbar({
  snapshot,
  viewer,
  exportable,
  onSelectDay,
}: {
  snapshot: SerpSnapshot | undefined;
  viewer: SerpViewer;
  exportable: boolean;
  onSelectDay: (date: string) => void;
}) {
  const dates = snapshot?.dates ?? [];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {snapshot ? null : <Skeleton className="h-8 w-60 md:h-9" />}
      {snapshot?.date && dates.length > 0 ? (
        <>
          <CapturedDayPicker
            dates={dates}
            value={snapshot.date}
            onSelect={onSelectDay}
          />
          <span className="text-caption text-muted-foreground">
            {comparisonCaption(snapshot.comparedTo)}
          </span>
        </>
      ) : null}
      <ExportCsvButton
        subject="the search results"
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
  viewer,
  exportable,
  onSelectDay,
}: {
  text: string | undefined;
  country: string | undefined;
  store: Store;
  snapshot: SerpSnapshot | undefined;
  viewer: SerpViewer;
  exportable: boolean;
  onSelectDay: (date: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        {text ? (
          <p translate="no" dir="auto" className="text-title wrap-anywhere">
            {text}
          </p>
        ) : null}
        {country ? (
          <p className="text-caption text-muted-foreground">
            {formatCountry(country)}, {storeLabel(store)}
          </p>
        ) : null}
      </div>
      <SerpToolbar
        snapshot={snapshot}
        viewer={viewer}
        exportable={exportable}
        onSelectDay={onSelectDay}
      />
    </div>
  );
}
