"use client";

import { useQueryStates } from "nuqs";
import { ArrowDown } from "lucide-react";
import type { AppStoreLocalization } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { LOCALIZATIONS_SECTION_ID } from "@/lib/app-localizations";
import { fieldFromDraftParser, fieldLocaleParser } from "@/lib/search-params";

export function KeywordFieldHandoff({
  localization,
}: {
  localization: AppStoreLocalization;
}) {
  const [, setQuery] = useQueryStates({
    fieldLocale: fieldLocaleParser,
    fieldFromDraft: fieldFromDraftParser,
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-fit"
      onClick={() =>
        void setQuery(
          { fieldLocale: localization, fieldFromDraft: true },
          { history: "push", scroll: false },
        ).then(() =>
          document
            .getElementById(LOCALIZATIONS_SECTION_ID)
            ?.scrollIntoView({ block: "start" }),
        )
      }
    >
      <ArrowDown aria-hidden />
      <span>Review in the keyword field editor</span>
    </Button>
  );
}
