"use client";

import { useQueryState, useQueryStates } from "nuqs";
import {
  isAppStoreLocalization,
  type AppLocalizationsResult,
  type AppStoreLocalization,
} from "@asobeast/shared";
import { focusDraftLocalization } from "@/components/metadata/DraftLocalizationSelect";
import { Accordion } from "@/components/ui/accordion";
import { openLocalization } from "@/lib/app-localizations";
import { additionOutcome } from "@/lib/keyword-field-addition";
import { draftableLocalizations, storefrontRows } from "@/lib/localizations";
import {
  draftLocaleParser,
  fieldAddParser,
  fieldLeftOutParser,
  fieldLocaleParser,
} from "@/lib/search-params";
import { KeywordFieldAdditionStatus } from "./KeywordFieldAdditionStatus";
import { LocalizationItem } from "./LocalizationItem";

export function LocalizationList({
  id,
  result,
  canDraft,
}: {
  id: string;
  result: AppLocalizationsResult;
  canDraft: boolean;
}) {
  const [
    { fieldLocale: requested, fieldAdd: added, fieldLeftOut: leftOut },
    setLocalizationQuery,
  ] = useQueryStates({
    fieldLocale: fieldLocaleParser,
    fieldAdd: fieldAddParser,
    fieldLeftOut: fieldLeftOutParser,
  });
  const outcome = additionOutcome(result, requested, added, leftOut);
  const proposalTarget =
    outcome?.state === "received" ? outcome.localization : null;
  const settleProposal = () =>
    void setLocalizationQuery(
      { fieldAdd: null, fieldLeftOut: null },
      { history: "replace" },
    );
  const [, setDraftLocale] = useQueryState("draftLocale", draftLocaleParser);
  const draftable = new Set(
    draftableLocalizations(storefrontRows(result.home, result.markets)),
  );
  const draft = (localization: AppStoreLocalization) => {
    void setDraftLocale(localization).then(focusDraftLocalization);
  };

  return (
    <>
      {outcome ? <KeywordFieldAdditionStatus outcome={outcome} /> : null}
      <Accordion
        type="single"
        collapsible={result.localizations.length > 1}
        value={openLocalization(result.localizations, requested)}
        onValueChange={(next) =>
          void setLocalizationQuery(
            {
              fieldLocale: isAppStoreLocalization(next) ? next : null,
              fieldAdd: null,
              fieldLeftOut: null,
            },
            { history: "replace" },
          )
        }
      >
        {result.localizations.map((item) => {
          const target = item.localization === proposalTarget;
          return (
            <LocalizationItem
              key={item.localization}
              id={id}
              item={item}
              managed={result.storeManaged}
              sync={result.storeSync}
              onDraft={
                canDraft && draftable.has(item.localization) ? draft : null
              }
              proposed={target ? added : null}
              onProposalSettled={target ? settleProposal : undefined}
            />
          );
        })}
      </Accordion>
    </>
  );
}
