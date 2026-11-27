import type {
  PlacementSuggestion,
  PlacementSuggestionField,
} from "@asobeast/shared";
import { isEdited, ROLE_SLOT_COUNT, type TargetSlots } from "./listing-targets";

type Placements = ReadonlyMap<string, PlacementSuggestion>;

const EXTRA_ORDER: Record<PlacementSuggestionField, number> = {
  title: 0,
  subtitle: 0,
  keywordField: 1,
  shortDescription: 1,
  description: 1,
  skip: 2,
};
const NO_PLACEMENT_ORDER = 3;

export function applyPlacements(
  slots: TargetSlots,
  placements: Placements,
): TargetSlots {
  const phrases = slots.filter((slot) => slot !== null);
  const suggested = (field: PlacementSuggestionField) =>
    phrases.filter((text) => placements.get(text)?.field === field);
  const [title = null] = suggested("title");
  const [first = null, second = null] = suggested("subtitle");
  const roles = [title, first, second];
  const extraOrder = (text: string) => {
    const field = placements.get(text)?.field;
    return field ? EXTRA_ORDER[field] : NO_PLACEMENT_ORDER;
  };
  const rest = phrases
    .filter((text) => !roles.includes(text))
    .sort((left, right) => extraOrder(left) - extraOrder(right));
  const extra = rest.slice(0, slots.length - ROLE_SLOT_COUNT);
  const overflow = rest.slice(extra.length);
  return Array.from({ length: slots.length }, (_, index) =>
    index < ROLE_SLOT_COUNT
      ? (roles[index] ?? overflow.shift() ?? null)
      : (extra[index - ROLE_SLOT_COUNT] ?? null),
  );
}

export function applyRefusal(
  slots: TargetSlots,
  placements: Placements,
): string | null {
  if (!slots.some((slot) => slot !== null && placements.has(slot))) {
    return "No target has a suggestion yet";
  }
  if (!isEdited(applyPlacements(slots, placements), slots)) {
    return "Your targets already follow the suggestions";
  }
  return null;
}
