import type { CompetitorItem } from "@asobeast/shared";
import { formatNumberInLocale, formatPrice, formatRating } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import type { MessageTranslator } from "@/i18n/translator";
import enCompetitors from "../../../messages/en/competitors.json";
import { createTranslator } from "next-intl";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

type Snapshot = NonNullable<CompetitorItem["latestSnapshot"]>;

function ratingText(snapshot: Snapshot, locale: Locale): string | null {
  if (snapshot.ratingAvg === null) return null;
  const rating = `★ ${formatRating(snapshot.ratingAvg)}`;
  return snapshot.ratingCount === null
    ? rating
    : `${rating} (${formatNumberInLocale(snapshot.ratingCount, locale)})`;
}

export function snapshotParts(
  snapshot: Snapshot | null,
  locale: Locale = "en",
  t: MessageTranslator = english,
  freeLabel = "Free",
): string[] {
  if (snapshot === null) return [t("snapshot.notCaptured")];
  const price =
    snapshot.price === null
      ? null
      : formatPrice(snapshot.price, snapshot.currency, freeLabel);
  const version = snapshot.version ? `v${snapshot.version}` : null;
  const parts = [ratingText(snapshot, locale), price, version].filter(
    (part) => part !== null,
  );
  return parts.length === 0 ? [t("snapshot.notCaptured")] : parts;
}
