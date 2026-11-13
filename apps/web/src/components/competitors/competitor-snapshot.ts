import type { CompetitorItem } from "@asobeast/shared";
import { formatNumber, formatPrice, formatRating } from "@/lib/format";

const NO_SNAPSHOT = "Not captured yet";

export function snapshotParts(
  snapshot: CompetitorItem["latestSnapshot"],
): string[] {
  if (snapshot === null) return [NO_SNAPSHOT];
  const rating =
    snapshot.ratingAvg === null
      ? null
      : `★ ${formatRating(snapshot.ratingAvg)}${
          snapshot.ratingCount === null
            ? ""
            : ` (${formatNumber(snapshot.ratingCount)})`
        }`;
  const price =
    snapshot.price === null
      ? null
      : formatPrice(snapshot.price, snapshot.currency);
  const version = snapshot.version ? `v${snapshot.version}` : null;
  const parts = [rating, price, version].filter((part) => part !== null);
  return parts.length === 0 ? [NO_SNAPSHOT] : parts;
}
