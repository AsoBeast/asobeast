"use client";

import { useCallback, useState } from "react";
import type { Store } from "@asobeast/shared";
import { ChangeActivity } from "./ChangeActivity";
import { ChangeFieldBreakdown } from "./ChangeFieldBreakdown";
import { ChangeImpactCard } from "./ChangeImpactCard";
import { ChangesHeader } from "./ChangesHeader";
import { ChangeTimeline } from "./ChangeTimeline";
import { CHANGES_GRID, CHANGES_MAIN, CHANGES_RAIL } from "./layout-classes";
import type { ShownChange } from "./timeline-days";
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
  const [shown, setShown] = useState<ShownChange | null>(null);
  const { clearFilter } = useChangeFilter();
  const clearShown = useCallback(() => setShown(null), []);
  const showChange = (change: ShownChange) => {
    clearFilter();
    setShown(change);
  };

  return (
    <div className="@container/changes page-wide flex flex-col gap-6">
      <ChangesHeader id={id} homeCountry={homeCountry} />
      <ChangeActivity
        id={id}
        homeCountry={homeCountry}
        onShowChange={showChange}
      />
      <ChangeImpactCard id={id} store={store} homeCountry={homeCountry} />
      <div className={CHANGES_GRID}>
        <div className={CHANGES_MAIN}>
          <ChangeTimeline id={id} shown={shown} onShown={clearShown} />
        </div>
        <div className={CHANGES_RAIL}>
          <ChangeFieldBreakdown id={id} />
        </div>
      </div>
    </div>
  );
}
