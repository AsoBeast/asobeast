"use client";

import { useState } from "react";
import type { KeywordFieldSuggestion } from "@asobeast/shared";
import { Card, CardContent } from "@/components/ui/card";

export function KeywordFieldSuggestionCard({
  suggestion,
}: {
  suggestion: KeywordFieldSuggestion;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(suggestion.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested keyword field
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {suggestion.charactersUsed}/{suggestion.charactersLimit}
          </span>
        </div>
        {suggestion.value.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Every tracked keyword is already covered.
          </p>
        ) : (
          <>
            <p className="mt-2 break-words rounded-lg bg-muted p-2 font-mono text-sm text-foreground">
              {suggestion.value}
            </p>
            <button
              type="button"
              onClick={copy}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted dark:hover:bg-secondary"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
