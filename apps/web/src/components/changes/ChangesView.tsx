"use client";

import { useCallback, useState } from "react";
import type { Store } from "@asobeast/shared";
import { ChangeActivity } from "./ChangeActivity";
import { ChangeFieldBreakdown } from "./ChangeFieldBreakdown";
import { ChangeImpactCard } from "./ChangeImpactCard";
import { ChangesHeader } from "./ChangesHeader";
import { ChangeTimeline } from "./ChangeTimeline";
import { CHANGES_GRID, CHANGES_MAIN, CHANGES_RAIL } from "./layout-classes";
import { useChangeFilter } from "./use-change-view";

export function ChangesView({
  id,
  store,
  homeCountry,
}: {
  id: string;
  store: Store;
  homeCountry: string;
}) {
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const { clearFilter } = useChangeFilter();
  const clearFocusDay = useCallback(() => setFocusDay(null), []);
  const showDay = (day: string) => {
    clearFilter();
    setFocusDay(day);
  };

  return (
    <div className="@container/changes page-wide flex flex-col gap-6">
      <ChangesHeader id={id} homeCountry={homeCountry} />
      <ChangeActivity id={id} homeCountry={homeCountry} onShowDay={showDay} />
      <ChangeImpactCard id={id} store={store} homeCountry={homeCountry} />
      <div className={CHANGES_GRID}>
        <div className={CHANGES_MAIN}>
          <ChangeTimeline
            id={id}
            focusDay={focusDay}
            onFocused={clearFocusDay}
          />
        </div>
        <div className={CHANGES_RAIL}>
          <ChangeFieldBreakdown id={id} />
        </div>
      </div>
    </div>
  );
}
