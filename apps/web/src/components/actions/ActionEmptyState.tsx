"use client";

import { ACTION_RULES } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimeInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { GenerateNowButton } from "./GenerateNowButton";
import { NumberedSteps } from "./NumberedSteps";

const howQueueIsMade = (t: ReturnType<typeof useTranslations>): string[] => [
  t("howQueue.rules", { count: ACTION_RULES.length }),
  t("howQueue.finding"),
  t("howQueue.confirm"),
];

export function ActionEmptyState({
  generatedAt,
  filtered,
  onClearFilters,
}: {
  generatedAt: string | null;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const t = useTranslations("actions");
  const locale = useAppLocale();
  if (generatedAt === null) {
    return (
      <EmptyState
        className="py-8"
        title={t("emptyNever")}
        action={
          <>
            <NumberedSteps
              steps={howQueueIsMade(t)}
              className="mx-auto max-w-[46ch] gap-3 text-left text-muted-foreground"
            />
            <GenerateNowButton generatedAt={generatedAt} />
          </>
        }
      />
    );
  }
  if (filtered) {
    return (
      <EmptyState
        className="py-8"
        title={t("emptyFiltered")}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {t("clearFilters")}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      className="py-8"
      title={t("emptyQuiet")}
      body={t("lastGenerated", {
        date: formatDateTimeInLocale(generatedAt, locale),
      })}
      action={<GenerateNowButton generatedAt={generatedAt} />}
    />
  );
}
