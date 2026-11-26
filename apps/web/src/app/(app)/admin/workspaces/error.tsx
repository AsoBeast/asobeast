"use client";

import { ErrorState } from "@/components/layout/ErrorState";
import { useTranslations } from "next-intl";

export default function AdminWorkspacesError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("admin");
  return (
    <ErrorState
      error={error}
      retry={retry}
      scope="admin"
      title={t("errors.workspaces")}
    />
  );
}
