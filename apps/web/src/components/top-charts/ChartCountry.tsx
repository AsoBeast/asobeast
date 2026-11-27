"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("topCharts");
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
      ariaLabel={t("country")}
      onChange={(next) => {
        setDraft(next);
        if (isStorefront(store, next)) onChange(next);
      }}
    />
  );
}
