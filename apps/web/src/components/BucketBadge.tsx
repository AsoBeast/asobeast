"use client";

import type { KeywordBucket } from "@asobeast/shared";
import { useTranslations } from "next-intl";

export const BUCKET_LABELS: Record<KeywordBucket, string> = {
  primary: "Primary",
  secondary: "Secondary",
  longtail: "Long tail",
  aspirational: "Aspirational",
};

export function BucketLabel({ bucket }: { bucket: KeywordBucket | null }) {
  const t = useTranslations("keywords");
  if (!bucket) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span>{t(`buckets.${bucket}`)}</span>;
}
