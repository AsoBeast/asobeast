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
  fieldFromDraftParser,
  fieldLeftOutParser,
  fieldLocaleParser,
} from "@/lib/search-params";
import {
  DraftedFieldStatus,
  useDraftedField,
  useHandoffGenerations,
} from "./DraftedFieldStatus";
import { editorKeyOf } from "./handoff-generations";
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
    {
      fieldLocale: requested,
      fieldAdd: added,
      fieldLeftOut: leftOut,
      fieldFromDraft: fromDraft,
    },
    setLocalizationQuery,
  ] = useQueryStates({
    fieldLocale: fieldLocaleParser,
    fieldAdd: fieldAddParser,
    fieldLeftOut: fieldLeftOutParser,
    fieldFromDraft: fieldFromDraftParser,
  });
  const outcome = additionOutcome(result, requested, added, leftOut);
  const proposalTarget =
    outcome?.state === "received" ? outcome.localization : null;
  const handoff = useDraftedField(
    id,
    fromDraft === true ? requested : null,
    result.storeManaged,
  );
  const handoffs = useHandoffGenerations(handoff);
  const settleProposal = () =>
    void setLocalizationQuery(
      { fieldAdd: null, fieldLeftOut: null, fieldFromDraft: null },
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
      {handoff ? <DraftedFieldStatus handoff={handoff} /> : null}
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
              fieldFromDraft: null,
            },
            { history: "replace" },
          )
        }
      >
        {result.localizations.map((item) => {
          const target = item.localization === proposalTarget;
          const handed = handoff?.localization === item.localization;
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
              drafted={handed ? handoff.text : undefined}
              editorKey={editorKeyOf(handoffs, item.localization)}
              onProposalSettled={target || handed ? settleProposal : undefined}
            />
          );
        })}
      </Accordion>
    </>
  );
}
