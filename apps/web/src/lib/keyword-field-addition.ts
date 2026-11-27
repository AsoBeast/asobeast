import { createSerializer } from "nuqs";
import { createTranslator } from "next-intl";
import enKeywords from "../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
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
import {
  fieldAddParser,
  fieldLeftOutParser,
  fieldLocaleParser,
} from "@/lib/search-params";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export interface KeywordFieldAddition {
  added: string[];
  held: string[];
  leftOut: number;
}

export type KeywordFieldAdditionOutcome =
  | { state: "managed" | "unlisted"; localization: AppStoreLocalization }
  | {
      state: "received";
      localization: AppStoreLocalization;
      addition: KeywordFieldAddition;
    };

const serializeAddition = createSerializer({
  fieldLocale: fieldLocaleParser,
  fieldAdd: fieldAddParser,
  fieldLeftOut: fieldLeftOutParser,
});

const newPhrases = (
  stored: readonly string[],
  proposed: readonly string[],
): string[] => {
  const held = new Set(stored);
  return proposed.filter((phrase) => !held.has(phrase));
};

const heldPhrases = (
  stored: readonly string[],
  proposed: readonly string[],
): string[] => {
  const held = new Set(stored);
  return proposed.filter((phrase) => held.has(phrase));
};

export const proposedKeywordField = (
  stored: readonly string[],
  added: readonly string[],
): string => [...stored, ...newPhrases(stored, added)].join(",");

const receivedPhrases = (proposed: readonly string[] | null): string[] =>
  proposed ? parseKeywordField(proposed.join(",")).phrases : [];

export function proposalDraft(
  stored: readonly string[],
  proposed: readonly string[] | null,
): string | null {
  const phrases = receivedPhrases(proposed);
  if (newPhrases(stored, phrases).length === 0) return null;
  return proposedKeywordField(stored, phrases);
}

export interface FieldSeed {
  fromDraft: string | undefined;
  fieldAdd: readonly string[] | null;
}

export function seededFieldDraft(
  stored: readonly string[],
  { fromDraft, fieldAdd }: FieldSeed,
  managed: boolean,
): string | null {
  if (managed) return null;
  if (fromDraft === undefined) return proposalDraft(stored, fieldAdd);
  const drafted = parseKeywordField(fromDraft).phrases;
  return drafted.join(",") === stored.join(",") ? null : fromDraft;
}

export const keywordFieldAdditionHref = (
  id: string,
  localization: AppStoreLocalization,
  { added, held, leftOut }: KeywordFieldAddition,
): string => {
  const carried = [...added, ...held];
  return `/apps/${id}/metadata${serializeAddition({
    fieldLocale: localization,
    fieldAdd: carried.length > 0 ? carried : null,
    fieldLeftOut: leftOut > 0 ? leftOut : null,
  })}#${LOCALIZATIONS_SECTION_ID}`;
};

export function receivedAddition(
  stored: readonly string[],
  proposed: readonly string[] | null,
  leftOut: number,
): KeywordFieldAddition {
  const phrases = receivedPhrases(proposed);
  return {
    added: newPhrases(stored, phrases),
    held: heldPhrases(stored, phrases),
    leftOut,
  };
}

export function additionOutcome(
  result: Pick<AppLocalizationsResult, "localizations" | "storeManaged">,
  requested: AppStoreLocalization | null,
  proposed: readonly string[] | null,
  leftOut: number | null,
): KeywordFieldAdditionOutcome | null {
  const left = leftOut ?? 0;
  if (requested === null) return null;
  if (receivedPhrases(proposed).length === 0 && left === 0) return null;
  const item = result.localizations.find(
    (each) => each.localization === requested,
  );
  if (!item) return { state: "unlisted", localization: requested };
  if (result.storeManaged) return { state: "managed", localization: requested };
  return {
    state: "received",
    localization: requested,
    addition: receivedAddition(item.phrases, proposed, left),
  };
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
    held: heldPhrases(stored, phrases),
    leftOut: fresh.length - added.length,
  };
}

export function additionNotice(
  { added, held, leftOut }: KeywordFieldAddition,
  name: string,
  t: MessageTranslator = english,
): string | null {
  const alreadyIn = held.length;
  if (leftOut > 0) {
    return t("field.leftOut", { count: leftOut, name });
  }
  if (alreadyIn === 0) return null;
  if (added.length === 0) {
    return t("field.everySelected", { name });
  }
  return t("field.alreadyIn", { count: alreadyIn, name });
}
