"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { isNotFound } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { keywordBreakdownOptions } from "@/lib/queries";
import { breakdownParser } from "@/lib/search-params";
import { BreakdownAppCard } from "./BreakdownAppCard";
import { useBreakdownOpener } from "./breakdown-opener";
import { COMPETITOR_SECTION } from "./competitor-sections";

function BreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

type BreakdownRead = ReturnType<typeof useBreakdown>;

const useBreakdown = (appId: string, keywordId: string) =>
  useQuery({
    ...keywordBreakdownOptions(appId, keywordId),
    enabled: keywordId !== "",
  });

const waitsForConnection = (read: BreakdownRead) =>
  read.data === undefined && read.fetchStatus === "paused";

const unavailable = (read: BreakdownRead) =>
  isNotFound(read.error) || failedRead(read) || waitsForConnection(read);

function BreakdownBody({
  appId,
  read,
  onClose,
}: {
  appId: string;
  read: BreakdownRead;
  onClose: () => void;
}) {
  const t = useTranslations("competitors");
  const common = useTranslations("common");
  if (read.data) {
    return (
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-3">
          {read.data.apps.map((app) => (
            <BreakdownAppCard
              key={app.appId}
              appId={appId}
              app={app}
              breakdown={read.data}
            />
          ))}
        </ul>
        <p className="text-caption text-muted-foreground">
          {t("breakdown.rules", { product: PRODUCT_NAME })}
        </p>
      </div>
    );
  }
  if (isNotFound(read.error)) {
    return (
      <div className="flex flex-col items-start gap-3 text-dense">
        <p>{t("breakdown.notTracked")}</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          {common("close")}
        </Button>
      </div>
    );
  }
  if (failedRead(read)) {
    return <InlineQueryError message={t("breakdown.loadFailed")} read={read} />;
  }
  if (waitsForConnection(read)) {
    return (
      <p role="status" className="text-dense text-muted-foreground">
        {t("breakdown.offline")}
      </p>
    );
  }
  return <BreakdownSkeleton />;
}

function descriptionOf(
  read: BreakdownRead,
  t: MessageTranslator,
  locale: Locale,
): string {
  if (read.data) {
    return t("breakdown.description", {
      keyword: read.data.text,
      market: formatCountryInLocale(read.data.country, locale),
    });
  }
  return unavailable(read)
    ? t("breakdown.fallbackDescription")
    : t("breakdown.loadingDescription");
}

export function KeywordBreakdownSheet({ appId }: { appId: string }) {
  const t = useTranslations("competitors");
  const locale = useAppLocale();
  const [keywordId, setKeywordId] = useQueryState("keyword", breakdownParser);
  const [shownId, setShownId] = useState(keywordId);
  if (keywordId !== "" && keywordId !== shownId) setShownId(keywordId);
  const read = useBreakdown(appId, shownId);
  const close = () => void setKeywordId(null);
  const opener = useBreakdownOpener();

  return (
    <Sheet
      open={keywordId !== ""}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          const target =
            opener.openerOf(shownId) ??
            document.querySelector<HTMLButtonElement>(
              `[data-breakdown-keyword="${CSS.escape(shownId)}"]`,
            ) ??
            document.querySelector<HTMLButtonElement>(
              `[data-section="${COMPETITOR_SECTION.matrix}"]`,
            );
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{t("breakdown.title")}</SheetTitle>
          <SheetDescription>{descriptionOf(read, t, locale)}</SheetDescription>
        </SheetHeader>
        <BreakdownBody appId={appId} read={read} onClose={close} />
      </SheetContent>
    </Sheet>
  );
}
