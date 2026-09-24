import type { KeywordBucket } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT: Record<
  KeywordBucket,
  "success" | "info" | "secondary" | "warning"
> = {
  primary: "success",
  secondary: "info",
  longtail: "secondary",
  aspirational: "warning",
};

export const BUCKET_LABELS: Record<KeywordBucket, string> = {
  primary: "Primary",
  secondary: "Secondary",
  longtail: "Long tail",
  aspirational: "Aspirational",
};

export function BucketBadge({ bucket }: { bucket: KeywordBucket | null }) {
  if (!bucket) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <Badge variant={VARIANT[bucket]}>{BUCKET_LABELS[bucket]}</Badge>;
}
