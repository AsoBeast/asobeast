import type {
  KeywordMarkSurface,
  SerpEntryItem,
  Store,
} from "@asobeast/shared";

type Listed = Pick<
  SerpEntryItem,
  | "subtitle"
  | "subtitleSegments"
  | "shortDescription"
  | "shortDescriptionSegments"
>;

export interface ListingLine {
  text: string;
  segments: SerpEntryItem["titleSegments"];
  surface: KeywordMarkSurface;
}

export const SECOND_FIELD_NAMES: Record<Store, string> = {
  APP_STORE: "subtitle",
  GOOGLE_PLAY: "short description",
};

export const secondTextOf = (
  entry: Pick<Listed, "subtitle" | "shortDescription">,
  store: Store,
): string | null | undefined =>
  store === "GOOGLE_PLAY" ? entry.shortDescription : entry.subtitle;

export function listingLineOf(entry: Listed): ListingLine | null {
  if (entry.shortDescription) {
    return {
      text: entry.shortDescription,
      segments: entry.shortDescriptionSegments,
      surface: "shortDescription",
    };
  }
  return entry.subtitle
    ? {
        text: entry.subtitle,
        segments: entry.subtitleSegments,
        surface: "subtitle",
      }
    : null;
}
