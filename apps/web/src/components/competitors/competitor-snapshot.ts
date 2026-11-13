import type { CompetitorItem } from "@asobeast/shared";
import { formatNumber, formatPrice, formatRating } from "@/lib/format";

type Snapshot = NonNullable<CompetitorItem["latestSnapshot"]>;

const NO_SNAPSHOT = "Not captured yet";

function ratingText(snapshot: Snapshot): string | null {
  if (snapshot.ratingAvg === null) return null;
  const rating = `★ ${formatRating(snapshot.ratingAvg)}`;
  return snapshot.ratingCount === null
    ? rating
    : `${rating} (${formatNumber(snapshot.ratingCount)})`;
}

export function snapshotParts(snapshot: Snapshot | null): string[] {
  if (snapshot === null) return [NO_SNAPSHOT];
  const price =
    snapshot.price === null
      ? null
      : formatPrice(snapshot.price, snapshot.currency);
  const version = snapshot.version ? `v${snapshot.version}` : null;
  const parts = [ratingText(snapshot), price, version].filter(
    (part) => part !== null,
  );
  return parts.length === 0 ? [NO_SNAPSHOT] : parts;
}
