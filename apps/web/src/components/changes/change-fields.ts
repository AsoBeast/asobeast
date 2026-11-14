import { CHANGE_FIELD_LABELS } from "@asobeast/shared";
import { formatList } from "@/lib/format";
import type { ChangeEventItem, ChangeField } from "@asobeast/shared";
import {
  CHANGE_FIELD_GROUPS,
  type ChangeFieldGroup,
  type ChangeOwner,
} from "@/lib/search-params";

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
};

export type ChangeKind = "text" | "visuals" | "release";

export const CHANGE_KINDS: readonly ChangeKind[] = [
  "text",
  "visuals",
  "release",
];

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  text: "Text",
  visuals: "Screenshots and icon",
  release: "Release and price",
};

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
};

export const changeKind = (field: ChangeField): ChangeKind =>
  GROUP_KIND[FIELD_GROUP[field]];

export const fieldGroupLabel = (group: ChangeFieldGroup): string =>
  CHANGE_FIELD_LABELS[group];

const NAMED_FIELDS = 3;

const groupsOf = (fields: readonly ChangeField[]): ChangeFieldGroup[] => [
  ...new Set(fields.map((field) => FIELD_GROUP[field])),
];

export const namesFields = (fields: readonly ChangeField[]): boolean =>
  groupsOf(fields).length <= NAMED_FIELDS;

export function changedFieldWords(fields: readonly ChangeField[]): string {
  const groups = groupsOf(fields);
  return groups.length > NAMED_FIELDS
    ? `${groups.length} fields`
    : formatList(groups.map((group) => fieldGroupLabel(group).toLowerCase()));
}

export function fieldPhrase(
  fields: readonly ChangeField[],
  article: string,
): string {
  const words = changedFieldWords(fields);
  return namesFields(fields) ? `${article} ${words}` : words;
}

export const changedFieldsText = (fields: readonly ChangeField[]): string[] =>
  fields.map((field) => CHANGE_FIELD_LABELS[field]);

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
