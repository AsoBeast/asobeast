"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { UtilizationMeter } from "@/components/capacity/UtilizationMeter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatNumber, storeLabel } from "@/lib/format";
import { budgetOptions } from "@/lib/queries";
import {
  utilizationLevel,
  utilizationPercent,
  utilizationStatus,
} from "@/lib/utilization";
import { budgetCompletionSentence } from "./budget-completion";
import { BudgetSplit } from "./BudgetSplit";
import { discoveryNote } from "./discovery-note";
import { localizationsNote, marketListingsNote } from "./market-listings-note";
import { PanelSubhead } from "./PanelSubhead";
import { PanelBody, SettingsPanel } from "./SettingsPanel";
import { StateWord } from "./StateWord";

const WARNING_COPY =
  "Daily jobs may not finish within store rate limits; remove keywords or countries, or raise SCRAPE_ITUNES_RPM at your own risk.";

export function BudgetCard() {
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const level = utilizationLevel(budget.utilization);
  const completion = budgetCompletionSentence(budget.completion, budget.total);
  const notes = [
    marketListingsNote(budget.marketListings),
    localizationsNote(budget.localizations),
    discoveryNote(budget.discovery),
  ].filter((note): note is string => note !== null);

  return (
    <SettingsPanel
      as="h2"
      title="Daily request budget"
      action={
        <StateWord tone={level === "ok" ? "on" : "warning"}>
          {`${utilizationStatus(budget.utilization)} · ${utilizationPercent(budget.utilization)}%`}
        </StateWord>
      }
      footer={completion ? <p className="numeric">{completion}</p> : null}
    >
      <PanelBody>
        <BudgetSplit budget={budget} />
        {notes.map((note) => (
          <p key={note} className="text-caption text-muted-foreground">
            {note}
          </p>
        ))}
        {level !== "ok" ? (
          <Alert variant={level === "danger" ? "destructive" : "default"}>
            <TriangleAlert />
            <AlertDescription>{WARNING_COPY}</AlertDescription>
          </Alert>
        ) : null}
      </PanelBody>
      <PanelSubhead as="p" title="By store" note="Used of the daily limit" />
      <ul className="flex flex-col">
        {budget.stores.map((store) => (
          <li
            key={store.store}
            className="flex flex-col gap-2 border-b border-border-subtle px-(--card-spacing) py-3 last:border-b-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-dense">
              <span>{storeLabel(store.store)}</span>
              <span className="numeric font-medium">
                {`${formatNumber(store.total)} of ${formatNumber(store.capacityPerDay)} a day · ${utilizationPercent(store.utilization)}%`}
              </span>
            </div>
            <UtilizationMeter
              label={`${storeLabel(store.store)} daily request utilization`}
              utilization={store.utilization}
            />
          </li>
        ))}
      </ul>
    </SettingsPanel>
  );
}
