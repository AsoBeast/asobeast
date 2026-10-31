import type { ReactNode } from "react";
import type { Store } from "@asobeast/shared";
import { formatCountry, formatDayMonth, storeLabel } from "@/lib/format";

export function SerpHeader({
  text,
  country,
  store,
  toolbar,
}: {
  text: string | undefined;
  country: string | undefined;
  store: Store;
  toolbar: ReactNode;
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {toolbar}
      </div>
    </div>
  );
}

export function comparisonCaption(comparedTo: string | null | undefined) {
  return comparedTo ? `vs ${formatDayMonth(comparedTo)}` : "No earlier capture";
}
