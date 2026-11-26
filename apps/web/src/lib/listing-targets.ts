import {
  countChars,
  normalizeText,
  targetSlotRole,
  TRACKED_KEYWORD_CHAR_LIMIT,
  type ListingTargetCandidate,
  type ListingTargetsRequest,
  type ListingTargetsResult,
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

export function readersLine(readers: readonly string[]): string {
  return readers.length === 0
    ? "No market you track reads this localization yet"
    : `Tracked in ${formatList(readers.map(formatCountry))}`;
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
