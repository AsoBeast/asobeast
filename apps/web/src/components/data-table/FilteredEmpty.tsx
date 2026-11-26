"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function FilteredEmpty({
  title,
  body,
  onClear,
}: {
  title: string;
  body?: string;
  onClear: () => void;
}) {
  const t = useTranslations("ui");
  return (
    <EmptyState
      title={title}
      body={body ?? t("filteredEmptyBody")}
      className="border-0"
      action={
        <Button
          data-action="clear-filters"
          variant="outline"
          size="sm"
          onClick={onClear}
        >
          {t("clearFilters")}
        </Button>
      }
    />
  );
}
