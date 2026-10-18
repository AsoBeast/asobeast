"use client";

import { useState } from "react";
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
import { formatCountry } from "@/lib/format";
import { keywordBreakdownOptions } from "@/lib/queries";
import { breakdownParser } from "@/lib/search-params";
import { BreakdownAppCard } from "./BreakdownAppCard";

const DESCRIPTION_ID = "breakdown-description";

function BreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-48 w-full rounded-xl" />
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

const unavailable = (read: BreakdownRead) =>
  isNotFound(read.error) || failedRead(read);

function BreakdownBody({
  appId,
  read,
  onClose,
}: {
  appId: string;
  read: BreakdownRead;
  onClose: () => void;
}) {
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
        <p className="text-xs text-muted-foreground">
          These are rules of thumb from what {PRODUCT_NAME} can see. Neither
          store publishes how it weighs a field, and installs are not visible
          for other apps.
        </p>
      </div>
    );
  }
  if (isNotFound(read.error)) {
    return (
      <div className="flex flex-col items-start gap-3 text-sm">
        <p>This keyword is not tracked any more.</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }
  if (failedRead(read)) {
    return (
      <InlineQueryError
        message="The breakdown could not be loaded."
        read={read}
      />
    );
  }
  return <BreakdownSkeleton />;
}

function descriptionOf(read: BreakdownRead): string {
  if (read.data) {
    return `“${read.data.text}” in ${formatCountry(read.data.country)}, from the latest daily check.`;
  }
  return unavailable(read)
    ? "Each app's listing judged against one tracked keyword."
    : "Loading the breakdown.";
}

export function KeywordBreakdownSheet({ appId }: { appId: string }) {
  const [keywordId, setKeywordId] = useQueryState("keyword", breakdownParser);
  const [shownId, setShownId] = useState(keywordId);
  if (keywordId !== "" && keywordId !== shownId) setShownId(keywordId);
  const read = useBreakdown(appId, shownId);
  const close = () => void setKeywordId(null);

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
        aria-describedby={DESCRIPTION_ID}
        onCloseAutoFocus={(event) => {
          const opener = document.querySelector<HTMLButtonElement>(
            `[data-breakdown-keyword="${CSS.escape(shownId)}"]`,
          );
          if (!opener) return;
          event.preventDefault();
          opener.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Why apps rank for this keyword</SheetTitle>
          <SheetDescription id={DESCRIPTION_ID}>
            {descriptionOf(read)}
          </SheetDescription>
        </SheetHeader>
        <BreakdownBody appId={appId} read={read} onClose={close} />
      </SheetContent>
    </Sheet>
  );
}
