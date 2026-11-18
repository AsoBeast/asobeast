import { createSerializer } from "nuqs";
import {
  KEYWORD_FIELD_CHAR_LIMIT,
  keywordFieldChars,
  packKeywordField,
  parseKeywordField,
  type AppLocalizationsResult,
  type AppStoreLocalization,
  type MarketLocalizationRead,
} from "@asobeast/shared";
import { LOCALIZATIONS_SECTION_ID } from "@/lib/app-localizations";
import { pluralize } from "@/lib/format";
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

export interface KeywordFieldTarget {
  localization: AppStoreLocalization;
  stored: readonly string[];
}

export function keywordFieldTarget(
  reads: readonly MarketLocalizationRead[],
): KeywordFieldTarget | null {
  const read = reads.find((each) => each.shipped) ?? reads[0];
  return read
    ? { localization: read.localization, stored: read.phrases }
    : null;
}

export interface KeywordFieldAddition {
  added: string[];
  alreadyIn: number;
  leftOut: number;
}

export function keywordFieldAddition(
  stored: readonly string[],
  selected: readonly string[],
): KeywordFieldAddition {
  const { phrases } = parseKeywordField(selected.join(","));
  const fresh = newPhrases(stored, phrases);
  const room = keywordFieldChars(stored) <= KEYWORD_FIELD_CHAR_LIMIT;
  const added = room
    ? newPhrases(stored, packKeywordField([...stored, ...fresh]))
    : [];
  return {
    added,
    alreadyIn: phrases.length - fresh.length,
    leftOut: fresh.length - added.length,
  };
}

export function additionNotice(
  { added, alreadyIn, leftOut }: KeywordFieldAddition,
  name: string,
): string | null {
  if (leftOut > 0) {
    return `${pluralize(leftOut, "keyword")} did not fit in the ${name} keyword field and ${leftOut === 1 ? "was" : "were"} left out.`;
  }
  if (alreadyIn === 0) return null;
  if (added.length === 0) {
    return `Every selected keyword is already in the ${name} keyword field.`;
  }
  return `${pluralize(alreadyIn, "keyword")} ${alreadyIn === 1 ? "is" : "are"} already in the ${name} keyword field.`;
}
