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

function BreakdownBody({
  appId,
  keywordId,
  onClose,
}: {
  appId: string;
  keywordId: string;
  onClose: () => void;
}) {
  const read = useQuery({
    ...keywordBreakdownOptions(appId, keywordId),
    enabled: keywordId !== "",
  });
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

function BreakdownDescription({
  appId,
  keywordId,
}: {
  appId: string;
  keywordId: string;
}) {
  const { data } = useQuery({
    ...keywordBreakdownOptions(appId, keywordId),
    enabled: keywordId !== "",
  });
  return (
    <SheetDescription id={DESCRIPTION_ID}>
      {data
        ? `“${data.text}” in ${formatCountry(data.country)}, from the latest daily check.`
        : "Loading the breakdown."}
    </SheetDescription>
  );
}

export function KeywordBreakdownSheet({ appId }: { appId: string }) {
  const [keywordId, setKeywordId] = useQueryState("keyword", breakdownParser);
  const [shownId, setShownId] = useState(keywordId);
  if (keywordId !== "" && keywordId !== shownId) setShownId(keywordId);
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
          <BreakdownDescription appId={appId} keywordId={shownId} />
        </SheetHeader>
        <BreakdownBody appId={appId} keywordId={shownId} onClose={close} />
      </SheetContent>
    </Sheet>
  );
}
