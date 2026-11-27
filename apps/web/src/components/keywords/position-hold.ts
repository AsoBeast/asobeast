import type { TrackedKeywordItem } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export interface HoldFact {
  label: string;
  value: string;
}

export function positionHoldFacts(
  keyword: TrackedKeywordItem,
  t: MessageTranslator = english,
): HoldFact[] {
  const best = keyword.bestPosition ?? null;
  const delta = keyword.positionDeltaFromBest ?? null;
  const held = keyword.daysInTier ?? null;
  const tier = keyword.heldTier ?? null;

  const facts: HoldFact[] = [];
  if (best !== null) {
    facts.push({ label: t("hold.best"), value: `#${best}` });
  }
  if (delta !== null) {
    facts.push({
      label: t("hold.fromBest"),
      value: delta === 0 ? t("hold.atBest") : t("hold.below", { count: delta }),
    });
  }
  if (held !== null && tier !== null) {
    facts.push({
      label: t("hold.held"),
      value: t("hold.heldValue", { tier, count: held }),
    });
  }
  return facts;
}
