"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { UtilizationMeter } from "@/components/capacity/UtilizationMeter";
import type { TranslationContext } from "@/i18n/translator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { storeLabel } from "@/lib/format";
import { budgetOptions } from "@/lib/queries";
import { utilizationLevel, utilizationPercent } from "@/lib/utilization";
import { useAppLocale } from "@/lib/use-app-locale";
import { budgetCompletionSentence } from "./budget-completion";
import { BudgetSplit } from "./BudgetSplit";
import { discoveryNote } from "./discovery-note";
import { localizationsNote, marketListingsNote } from "./market-listings-note";
import { PanelSubhead } from "./PanelSubhead";
import { PanelBody, SettingsPanel } from "./SettingsPanel";
import { StateWord } from "./StateWord";

export function BudgetCard() {
  const t = useTranslations("settings");
  const locale = useAppLocale();
  const context: TranslationContext = { translator: t, locale };
  const { data: budget } = useSuspenseQuery(budgetOptions);
  const level = utilizationLevel(budget.utilization);
  const completion = budgetCompletionSentence(
    budget.completion,
    budget.total,
    context,
  );
  const notes = [
    marketListingsNote(budget.marketListings, t),
    localizationsNote(budget.localizations, t),
    discoveryNote(budget.discovery, t),
  ].filter((note): note is string => note !== null);
  const status =
    budget.utilization > 1
      ? "overCapacity"
      : level === "danger"
        ? "nearCapacity"
        : level === "warn"
          ? "high"
          : "healthy";

  return (
    <SettingsPanel
      as="h2"
      title={t("capacity.title")}
      action={
        <StateWord tone={level === "ok" ? "on" : "warning"}>
          {t("capacity.statusValue", {
            status: t(`capacity.status.${status}`),
            percent: utilizationPercent(budget.utilization),
          })}
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
            <AlertDescription>{t("capacity.warning")}</AlertDescription>
          </Alert>
        ) : null}
      </PanelBody>
      <PanelSubhead
        as="p"
        title={t("capacity.byStore")}
        note={t("capacity.usedOfDailyLimit")}
      />
      <ul className="flex flex-col">
        {budget.stores.map((store) => (
          <li
            key={store.store}
            className="flex flex-col gap-2 border-b border-border-subtle px-(--card-spacing) py-3 last:border-b-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-dense">
              <span>{storeLabel(store.store)}</span>
              <span className="numeric font-medium">
                {t("capacity.storePerDay", {
                  used: store.total,
                  limit: store.capacityPerDay,
                  percent: utilizationPercent(store.utilization),
                })}
              </span>
            </div>
            <UtilizationMeter
              label={t("capacity.storeUtilization", {
                store: storeLabel(store.store),
              })}
              utilization={store.utilization}
            />
          </li>
        ))}
      </ul>
    </SettingsPanel>
  );
}
