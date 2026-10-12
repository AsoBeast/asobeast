"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  KEYWORD_FIELD_CHAR_LIMIT,
  type AppLocalizationItem,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { Textarea } from "@/components/ui/textarea";
import {
  keywordFieldDraft,
  readingStorefrontNames,
} from "@/lib/app-localizations";
import { formatList } from "@/lib/format";
import { localizationName } from "@/lib/localizations";
import { cn } from "@/lib/utils";
import { useKeywordFieldSave } from "./useKeywordFieldSave";

export function KeywordFieldEditor({
  id,
  item,
}: {
  id: string;
  item: AppLocalizationItem;
}) {
  const countId = useId();
  const name = localizationName(item.localization);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? item.phrases.join(",");
  const field = keywordFieldDraft(text, item.phrases);
  const over = field.over > 0;
  const { pending, error, clearError, save } = useKeywordFieldSave(
    id,
    item,
    () => setDraft(null),
  );

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={text}
        onChange={(event) => {
          setDraft(event.target.value);
          clearError();
        }}
        rows={3}
        spellCheck={false}
        aria-label={`${name} keyword field`}
        aria-describedby={countId}
        aria-invalid={over}
        placeholder="fitness,workout,running,cardio"
      />
      <Meter
        value={Math.min(field.used, KEYWORD_FIELD_CHAR_LIMIT)}
        max={KEYWORD_FIELD_CHAR_LIMIT}
        tone="health"
        fill={over ? "bg-destructive" : undefined}
      />
      <div className="flex items-center justify-between gap-3 text-caption">
        <span className="text-muted-foreground">
          Separate keywords with commas.
        </span>
        <span
          id={countId}
          aria-live="polite"
          className={cn(
            "numeric font-mono",
            over ? "font-medium text-signal-down" : "text-muted-foreground",
          )}
        >
          {field.used}/{KEYWORD_FIELD_CHAR_LIMIT}
          {over ? ` · ${field.over} over the limit` : ""}
        </span>
      </div>
      {field.storedAs === null ? null : (
        <p className="text-caption text-muted-foreground">
          Stored as{" "}
          <span className="font-mono break-all">{field.storedAs}</span>
        </p>
      )}
      {item.readBy.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          None of your markets reads {name}. Storefronts that read it:{" "}
          {formatList(readingStorefrontNames(item.localization))}. Add one of
          them as a keyword market to track these phrases there.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          disabled={
            pending || over || (!field.changed && field.phrases.length === 0)
          }
          onClick={() => save(text)}
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Save keyword field"}
        </Button>
      </div>
    </div>
  );
}
