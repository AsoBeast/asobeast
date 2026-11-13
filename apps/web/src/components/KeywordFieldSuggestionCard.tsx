"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Copy } from "lucide-react";
import {
  keywordFieldLocalizations,
  type KeywordFieldSuggestion,
} from "@asobeast/shared";
import {
  SUB_HEADER,
  SUB_HEADER_COUNT,
} from "@/components/localizations/panel-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { editLocalizationHref } from "@/lib/app-localizations";
import { formatList } from "@/lib/format";
import { localizationName } from "@/lib/localizations";

const COPIED_MS = 1500;

interface SuggestionProps {
  id: string;
  home: string;
  suggestion: KeywordFieldSuggestion;
}

export function KeywordFieldSuggestionRow({
  id,
  home,
  suggestion,
  heading: Heading = "h3",
}: SuggestionProps & { heading?: "h2" | "h3" }) {
  const headingId = useId();
  const [copied, setCopied] = useState(false);
  const editHref = editLocalizationHref(
    id,
    suggestion.localization ?? keywordFieldLocalizations(home)[0],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(suggestion.value);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <Heading id={headingId} className={SUB_HEADER}>
        <span>
          {`Suggested keyword field${
            suggestion.localization
              ? ` · ${localizationName(suggestion.localization)}`
              : ""
          }`}
        </span>
        <span className={SUB_HEADER_COUNT}>
          {`${suggestion.charactersUsed}/${suggestion.charactersLimit}`}
        </span>
      </Heading>
      {suggestion.value.length === 0 ? (
        <p className="px-4 py-3 text-dense text-muted-foreground">
          Every tracked keyword is already covered.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p translate="no" dir="auto" className="text-body wrap-anywhere">
              {suggestion.value}
            </p>
            {suggestion.addedTerms.length > 0 ? (
              <p className="text-caption text-faint-foreground">
                <span>Adds </span>
                <span translate="no" className="font-medium text-foreground">
                  {formatList(suggestion.addedTerms)}
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy aria-hidden />
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>
            <Link
              href={editHref}
              className="text-dense text-foreground link-underline"
            >
              Edit this keyword field
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

export function KeywordFieldSuggestionCard(props: SuggestionProps) {
  return (
    <Card className="gap-0 py-0">
      <KeywordFieldSuggestionRow {...props} heading="h2" />
    </Card>
  );
}
