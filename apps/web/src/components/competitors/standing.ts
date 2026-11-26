import type {
  CompetitorMetadataRow,
  PositionMapPoint,
  Store,
} from "@asobeast/shared";
import { STORE_FIELD_LIMITS } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enCompetitors from "../../../messages/en/competitors.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

export const STANDING_VIEWS = ["visibility", "text"] as const;
export type StandingView = (typeof STANDING_VIEWS)[number];

export const STANDING_VIEW_LABELS: Record<StandingView, string> = {
  visibility: "Visibility",
  text: "Listing text",
};

export function standingRows(
  points: readonly PositionMapPoint[],
): PositionMapPoint[] {
  return [...points].sort(
    (a, b) => b.visibility - a.visibility || Number(b.isYou) - Number(a.isYou),
  );
}

export function hasRival(rows: readonly { isYou: boolean }[]): boolean {
  return rows.some((row) => !row.isYou);
}

export function barShare(visibility: number): number {
  return Math.min(100, Math.max(0, visibility));
}

export interface ListingLine {
  label: string;
  text: string | null;
  count: string;
  over: boolean;
}

export function listingLines(
  row: CompetitorMetadataRow,
  store: Store,
  t: MessageTranslator = english,
): ListingLine[] {
  const limits = STORE_FIELD_LIMITS[store];
  const line = (
    label: string,
    text: string | null,
    chars: number,
    limit: number,
  ): ListingLine => ({
    label,
    text: text === null || text === "" ? null : text,
    count: `${chars}/${limit}`,
    over: chars > limit,
  });
  return [
    ...(limits.title
      ? [line(t("fields.title"), row.title, row.titleChars, limits.title.limit)]
      : []),
    ...(limits.subtitle
      ? [
          line(
            t("fields.subtitle"),
            row.subtitle,
            row.subtitleChars,
            limits.subtitle.limit,
          ),
        ]
      : []),
  ];
}
