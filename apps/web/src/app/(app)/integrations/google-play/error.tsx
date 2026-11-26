"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/layout/ErrorState";

export default function PlaySignInError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errors");
  return (
    <ErrorState error={error} retry={retry} title={t("boundary.googlePlay")} />
  );
}
