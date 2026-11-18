import { createSerializer } from "nuqs";
import type {
  AppLocalizationsResult,
  AppStoreLocalization,
} from "@asobeast/shared";
import { LOCALIZATIONS_SECTION_ID } from "@/lib/app-localizations";
import { fieldAddParser, fieldLocaleParser } from "@/lib/search-params";

export type KeywordFieldAdditionState = "added" | "managed" | "unlisted";

export interface KeywordFieldAdditionOutcome {
  state: KeywordFieldAdditionState;
  localization: AppStoreLocalization;
  count: number;
}

const serializeAddition = createSerializer({
  fieldLocale: fieldLocaleParser,
  fieldAdd: fieldAddParser,
});

const newPhrases = (
  stored: readonly string[],
  proposed: readonly string[],
): string[] => {
  const held = new Set(stored);
  return proposed.filter((phrase) => !held.has(phrase));
};

export const proposedKeywordField = (
  stored: readonly string[],
  added: readonly string[],
): string => [...stored, ...newPhrases(stored, added)].join(",");

export function proposalDraft(
  stored: readonly string[],
  proposed: readonly string[] | null,
): string | null {
  if (!proposed || newPhrases(stored, proposed).length === 0) return null;
  return proposedKeywordField(stored, proposed);
}

export const keywordFieldAdditionHref = (
  id: string,
  localization: AppStoreLocalization,
  added: readonly string[],
): string =>
  `/apps/${id}/metadata${serializeAddition({
    fieldLocale: localization,
    fieldAdd: added.length > 0 ? [...added] : null,
  })}#${LOCALIZATIONS_SECTION_ID}`;

export function additionOutcome(
  result: Pick<AppLocalizationsResult, "localizations" | "storeManaged">,
  requested: AppStoreLocalization | null,
  added: readonly string[] | null,
): KeywordFieldAdditionOutcome | null {
  if (requested === null || !added || added.length === 0) return null;
  const item = result.localizations.find(
    (each) => each.localization === requested,
  );
  const refused = (state: KeywordFieldAdditionState) => ({
    state,
    localization: requested,
    count: added.length,
  });
  if (!item) return refused("unlisted");
  if (result.storeManaged) return refused("managed");
  const count = newPhrases(item.phrases, added).length;
  return count === 0
    ? null
    : { state: "added", localization: requested, count };
}
