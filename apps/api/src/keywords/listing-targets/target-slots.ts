import { LISTING_TARGET_LIMIT } from '@asobeast/shared';
import { checkKeywordText } from '../keywords.support';

export type TargetSlotsCheck =
  { ok: true; slots: string[] } | { ok: false; message: string };

const EMPTY = '';

const withoutTrailingEmpties = (slots: readonly string[]): string[] => {
  const kept = [...slots];
  while (kept.at(-1) === EMPTY) {
    kept.pop();
  }
  return kept;
};

export function normalizeTargetSlots(
  raw: readonly (string | null)[],
): TargetSlotsCheck {
  if (raw.length > LISTING_TARGET_LIMIT) {
    return {
      ok: false,
      message: `A localization takes at most ${LISTING_TARGET_LIMIT} target keywords, this list has ${raw.length}`,
    };
  }
  const slots: string[] = [];
  const firstAt = new Map<string, number>();
  for (const [index, value] of raw.entries()) {
    const position = index + 1;
    const check = value === null ? null : checkKeywordText(value);
    if (check === null || (!check.ok && check.reason === 'empty')) {
      slots.push(EMPTY);
      continue;
    }
    if (!check.ok) {
      return { ok: false, message: `Target ${position}: ${check.message}` };
    }
    const first = firstAt.get(check.text);
    if (first !== undefined) {
      return {
        ok: false,
        message: `Targets ${first} and ${position} are both "${check.text}"`,
      };
    }
    firstAt.set(check.text, position);
    slots.push(check.text);
  }
  return { ok: true, slots: withoutTrailingEmpties(slots) };
}

export const phrasesToTrack = (
  slots: readonly string[],
  stored: readonly string[],
  trackMissing: boolean,
): string[] =>
  slots.filter(
    (slot) => slot !== EMPTY && (trackMissing || !stored.includes(slot)),
  );

export const targetPairs = (
  phrases: readonly string[],
  readers: readonly string[],
): { text: string; country: string }[] =>
  phrases.flatMap((text) => readers.map((country) => ({ text, country })));
