import {
  countChars,
  normalizeText,
  targetSlotRole,
  TRACKED_KEYWORD_CHAR_LIMIT,
  type ListingTargetCandidate,
  type ListingTargetsRequest,
  type ListingTargetsResult,
  type TargetNotTracked,
  type TargetScores,
} from "@asobeast/shared";
import { formatCountry, formatList } from "./format";

export type TargetSlots = readonly (string | null)[];

const ROLE_LABELS = { title: "Title", subtitle: "Subtitle" } as const;

export function slotLabel(index: number): string {
  const role = targetSlotRole(index);
  return role === "extra" ? `Keyword ${index + 1}` : ROLE_LABELS[role];
}

export const savedSlots = (result: ListingTargetsResult): TargetSlots =>
  result.slots.map((slot) => slot?.text ?? null);

export const withSlot = (
  slots: TargetSlots,
  index: number,
  text: string | null,
): TargetSlots => slots.map((slot, at) => (at === index ? text : slot));

export const withoutSlot = (slots: TargetSlots, index: number): TargetSlots =>
  withSlot(slots, index, null);

export const saveRequestOf = (
  slots: TargetSlots,
  trackMissing = false,
): ListingTargetsRequest => ({
  slots: [...slots],
  ...(trackMissing ? { trackMissing } : {}),
});

export const isEdited = (slots: TargetSlots, saved: TargetSlots): boolean =>
  slots.some((slot, index) => slot !== saved[index]);

export function moveSlot(
  slots: TargetSlots,
  from: number,
  to: number,
): TargetSlots {
  if (to < 0 || to >= slots.length || from === to) return slots;
  return slots.map((slot, index) => {
    if (index === from) return slots[to];
    if (index === to) return slots[from];
    return slot;
  });
}

export const ROLE_SLOT_COUNT = 3;

export function withTopThree(
  slots: TargetSlots,
  candidates: readonly ListingTargetCandidate[],
): TargetSlots {
  const queue = openCandidates(candidates, slots).map(({ text }) => text);
  return slots.map((slot, index) =>
    index < ROLE_SLOT_COUNT && slot === null ? (queue.shift() ?? null) : slot,
  );
}

export const roleSlotsFilled = (slots: TargetSlots): boolean =>
  slots.slice(0, ROLE_SLOT_COUNT).every((slot) => slot !== null);

export function topThreeRefusal(
  slots: TargetSlots,
  candidates: readonly ListingTargetCandidate[],
): string | null {
  if (roleSlotsFilled(slots)) {
    return "Title and subtitle slots are already filled";
  }
  if (openCandidates(candidates, slots).length === 0) {
    return "No tracked keyword is left to pick";
  }
  return null;
}

export const editsAfterSave = (
  edits: TargetSlots | null,
  submitted: readonly (string | null)[],
): TargetSlots | null =>
  edits === null || !isEdited(edits, submitted) ? null : edits;

export function targetPhrase(typed: string): string | null {
  const text = normalizeText(typed);
  if (text === "" || countChars(text) > TRACKED_KEYWORD_CHAR_LIMIT) {
    return null;
  }
  return text;
}

export function slotHolding(slots: TargetSlots, text: string): number | null {
  const index = slots.indexOf(text);
  return index === -1 ? null : index;
}

export const openCandidates = (
  candidates: readonly ListingTargetCandidate[],
  slots: TargetSlots,
): ListingTargetCandidate[] =>
  candidates.filter(({ text }) => !slots.includes(text));

export function scoresByPhrase(
  result: ListingTargetsResult,
): ReadonlyMap<string, TargetScores> {
  const scores = new Map<string, TargetScores>();
  for (const { text, lead } of result.candidates) scores.set(text, lead);
  for (const slot of result.slots) {
    if (slot?.lead) scores.set(slot.text, slot.lead);
  }
  return scores;
}

export const untrackedByPhrase = (
  result: ListingTargetsResult,
): ReadonlyMap<string, readonly string[]> =>
  new Map(
    result.slots.flatMap((slot) =>
      slot ? [[slot.text, slot.untrackedIn] as const] : [],
    ),
  );

export function readersLine(readers: readonly string[]): string {
  return readers.length === 0
    ? "No market you track reads this localization yet"
    : `Read in ${formatList(readers.map(formatCountry))}`;
}

function trackedAt(result: ListingTargetsResult): Map<string, Set<string>> {
  return new Map(
    result.slots.flatMap((slot) =>
      slot
        ? [[slot.text, new Set(slot.trackedIn.map(({ country }) => country))]]
        : [],
    ),
  );
}

export function savedSentence(
  before: ListingTargetsResult | undefined,
  after: ListingTargetsResult,
): string {
  const earlier = before ? trackedAt(before) : new Map<string, Set<string>>();
  const started = [...trackedAt(after)].flatMap(([text, countries]) => {
    const added = [...countries].filter(
      (country) => !earlier.get(text)?.has(country),
    );
    return added.length > 0 ? [{ text, added }] : [];
  });
  if (started.length === 0) return "Targets saved.";
  if (started.length > 1) {
    return `Targets saved. ${started.length} keywords are now tracked.`;
  }
  const [{ text, added }] = started;
  return `Targets saved. ${text} is now tracked in ${formatList(added.map(formatCountry))}.`;
}

function countriesByPhrase(
  notTracked: readonly TargetNotTracked[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const { text, country } of notTracked) {
    grouped.set(text, [...(grouped.get(text) ?? []), country]);
  }
  return grouped;
}

const LIMIT_REASON = "your plan's keyword limit is reached.";

export function notTrackedSentence(
  notTracked: readonly TargetNotTracked[],
): string | null {
  const grouped = countriesByPhrase(notTracked);
  if (grouped.size === 0) return null;
  if (grouped.size > 1) {
    return `${grouped.size} keywords were not tracked: ${LIMIT_REASON}`;
  }
  const [[text, countries]] = grouped;
  return `${text} was not tracked in ${formatList(countries.map(formatCountry))}: ${LIMIT_REASON}`;
}

export const notTrackedLines = (
  notTracked: readonly TargetNotTracked[],
): string[] =>
  [...countriesByPhrase(notTracked)].map(
    ([text, countries]) =>
      `${text} in ${formatList(countries.map(formatCountry))}`,
  );

export const missingMarkets = (result: ListingTargetsResult): string[] =>
  result.readers.filter((country) =>
    result.slots.some((slot) => slot?.untrackedIn.includes(country)),
  );

export function untrackedLine(countries: readonly string[]): string | null {
  return countries.length === 0
    ? null
    : `Not tracked in ${formatList(countries.map(formatCountry))}`;
}
