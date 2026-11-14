import type { KeywordBucket } from "@asobeast/shared";

export const BUCKET_LABELS: Record<KeywordBucket, string> = {
  primary: "Primary",
  secondary: "Secondary",
  longtail: "Long tail",
  aspirational: "Aspirational",
};

export function BucketLabel({ bucket }: { bucket: KeywordBucket | null }) {
  if (!bucket) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span>{BUCKET_LABELS[bucket]}</span>;
}
