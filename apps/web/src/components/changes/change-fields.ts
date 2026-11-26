import { createTranslator } from "next-intl";
import enChanges from "../../../messages/en/changes.json";
import { changeFieldLabel } from "@/lib/change-field-label";
import type { MessageTranslator } from "@/i18n/translator";
import { formatListInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { ChangeEventItem, ChangeField } from "@asobeast/shared";
import {
  CHANGE_FIELD_GROUPS,
  type ChangeFieldGroup,
  type ChangeOwner,
} from "@/lib/search-params";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

const FIELD_GROUP: Record<ChangeField, ChangeFieldGroup> = {
  title: "title",
  subtitle: "subtitle",
  summary: "summary",
  description: "description",
  version: "version",
  price: "price",
  screenshots: "screenshots",
  screenshotImages: "screenshots",
  screenshotCaptions: "screenshots",
  icon: "icon",
  whatsNew: "whatsNew",
  inAppEvents: "inAppEvents",
  featuring: "featuring",
  editorsChoice: "editorsChoice",
};

export type ChangeKind = "text" | "visuals" | "release" | "store";

export const CHANGE_KINDS: readonly ChangeKind[] = [
  "text",
  "visuals",
  "release",
  "store",
];

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  text: "Text",
  visuals: "Screenshots and icon",
  release: "Release and price",
  store: "Events, featuring and badges",
};

export function changeKindLabel(
  kind: ChangeKind,
  t: MessageTranslator = english,
): string {
  return t(`kinds.${kind}`);
}

const GROUP_KIND: Record<ChangeFieldGroup, ChangeKind> = {
  title: "text",
  subtitle: "text",
  summary: "text",
  description: "text",
  screenshots: "visuals",
  icon: "visuals",
  version: "release",
  whatsNew: "release",
  price: "release",
  inAppEvents: "store",
  featuring: "store",
  editorsChoice: "store",
};

export const changeKind = (field: ChangeField): ChangeKind =>
  GROUP_KIND[FIELD_GROUP[field]];

const STORE_DECIDED_FIELDS: ReadonlySet<ChangeField> = new Set([
  "featuring",
  "editorsChoice",
]);

export interface AttributedFields {
  yours: ChangeField[];
  storeDecided: ChangeField[];
}

export const attributeFields = (
  fields: readonly ChangeField[],
): AttributedFields => ({
  yours: fields.filter((field) => !STORE_DECIDED_FIELDS.has(field)),
  storeDecided: fields.filter((field) => STORE_DECIDED_FIELDS.has(field)),
});

export const fieldGroupLabel = (
  group: ChangeFieldGroup,
  t: MessageTranslator = english,
): string => changeFieldLabel(group, t);

const NAMED_FIELDS = 3;

const groupsOf = (fields: readonly ChangeField[]): ChangeFieldGroup[] => [
  ...new Set(fields.map((field) => FIELD_GROUP[field])),
];

export const namesFields = (fields: readonly ChangeField[]): boolean =>
  groupsOf(fields).length <= NAMED_FIELDS;

export function changedFieldWords(
  fields: readonly ChangeField[],
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const groups = groupsOf(fields);
  if (groups.length > NAMED_FIELDS) {
    return t("lede.fieldCount", { count: groups.length });
  }
  return formatListInLocale(
    groups.map((group) => {
      const label = fieldGroupLabel(group, t);
      return locale === "en" ? label.toLowerCase() : label;
    }),
    locale,
  );
}

export function fieldPhrase(
  fields: readonly ChangeField[],
  article: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const words = changedFieldWords(fields, t, locale);
  return namesFields(fields) && locale === "en" ? `${article} ${words}` : words;
}

export const changedFieldsText = (
  fields: readonly ChangeField[],
  t: MessageTranslator = english,
): string[] => fields.map((field) => changeFieldLabel(field, t));

export const dayOf = (event: ChangeEventItem): string =>
  event.capturedAt.slice(0, 10);

export interface ChangeFilter {
  owner: ChangeOwner;
  field: ChangeFieldGroup | null;
}

export function matchesFilter(
  event: ChangeEventItem,
  { owner, field }: ChangeFilter,
): boolean {
  const owned =
    owner === "all" || event.isCompetitor === (owner === "competitors");
  return owned && (field === null || FIELD_GROUP[event.field] === field);
}

export interface OwnerCounts {
  all: number;
  yours: number;
  competitors: number;
}

export function ownerCounts(events: readonly ChangeEventItem[]): OwnerCounts {
  const competitors = events.filter((event) => event.isCompetitor).length;
  return {
    all: events.length,
    yours: events.length - competitors,
    competitors,
  };
}

export interface FieldCount {
  group: ChangeFieldGroup;
  yours: number;
  competitors: number;
}

export function fieldCounts(events: readonly ChangeEventItem[]): FieldCount[] {
  const counts = new Map<ChangeFieldGroup, FieldCount>();
  for (const event of events) {
    const group = FIELD_GROUP[event.field];
    const count = counts.get(group) ?? { group, yours: 0, competitors: 0 };
    if (event.isCompetitor) count.competitors += 1;
    else count.yours += 1;
    counts.set(group, count);
  }
  const total = (count: FieldCount) => count.yours + count.competitors;
  return [...counts.values()].sort(
    (a, b) =>
      total(b) - total(a) ||
      CHANGE_FIELD_GROUPS.indexOf(a.group) -
        CHANGE_FIELD_GROUPS.indexOf(b.group),
  );
}
