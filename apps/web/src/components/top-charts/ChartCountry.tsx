"use client";

import { useState } from "react";
import { isStorefront, type Store } from "@asobeast/shared";
import { CountrySelect } from "@/components/CountrySelect";

export function ChartCountry({
  store,
  country,
  onChange,
}: {
  store: Store;
  country: string;
  onChange: (country: string) => void;
}) {
  const chart = `${store}~${country}`;
  const [draft, setDraft] = useState(country);
  const [draftChart, setDraftChart] = useState(chart);

  if (draftChart !== chart) {
    setDraftChart(chart);
    setDraft(country);
  }

  return (
    <CountrySelect
      id="chart-country"
      store={store}
      value={draft}
      ariaLabel="Country"
      onChange={(next) => {
        setDraft(next);
        if (isStorefront(store, next)) onChange(next);
      }}
    />
  );
}
