"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";

export default function MetadataError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <ErrorState error={error} retry={retry} title={t("boundary.metadata")} />
  );
}
