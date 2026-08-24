"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  KEYWORD_FIELD_CHAR_LIMIT,
  type KeywordFieldResult,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, setKeywordField } from "@/lib/api";
import { formatCountry } from "@/lib/format";
import { invalidateKeywordMutation } from "@/lib/queries";
import { cn } from "@/lib/utils";

function ResultView({ result }: { result: KeywordFieldResult }) {
  const over = result.charactersUsed > result.charactersLimit;
  const width = Math.min(
    (result.charactersUsed / result.charactersLimit) * 100,
    100,
  );
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Characters used</span>
        <span
          className={cn("font-medium tabular-nums", over && "text-destructive")}
        >
          {result.charactersUsed}/{result.charactersLimit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            over ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">
            {result.tracked.length}
          </span>{" "}
          tracked
        </span>
        <span>
          <span className="font-medium text-foreground tabular-nums">
            {result.duplicatesRemoved}
          </span>{" "}
          duplicate{result.duplicatesRemoved === 1 ? "" : "s"} removed
        </span>
      </div>
      {result.tracked.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {result.tracked.map((keyword) => (
            <Badge key={keyword.keywordId} variant="secondary">
              {keyword.text}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function KeywordFieldEditor({
  id,
  homeCountry,
  activeMarket,
}: {
  id: string;
  homeCountry: string;
  activeMarket: string;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [result, setResult] = useState<KeywordFieldResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const over = text.length > KEYWORD_FIELD_CHAR_LIMIT;
  const homeMarket = activeMarket === homeCountry;

  const mutation = useMutation({
    mutationFn: () => setKeywordField(id, text),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      invalidateKeywordMutation(queryClient, id);
      toast.success("Saved keyword field", {
        description: `${data.tracked.length} tracked · ${data.duplicatesRemoved} duplicate${
          data.duplicatesRemoved === 1 ? "" : "s"
        } removed`,
      });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.envelope.message
          : "Could not save the keyword field",
      ),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" />
          App Store keyword field · {formatCountry(homeCountry)}
        </CardTitle>
        <CardDescription>
          This {KEYWORD_FIELD_CHAR_LIMIT}-character field is private — Apple
          never shows it and it cannot be scraped. Paste exactly what you
          submitted in App Store Connect. It applies to your home market only.
        </CardDescription>
      </CardHeader>
      {!homeMarket ? (
        <CardContent>
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            The keyword field is tracked for your home market (
            {formatCountry(homeCountry)}) only. Switch to that market to edit
            it.
          </p>
        </CardContent>
      ) : (
        <CardContent className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
            rows={3}
            spellCheck={false}
            aria-label="App Store keyword field"
            placeholder="fitness,workout,running,cardio…"
            aria-invalid={over}
            aria-describedby="keyword-field-count"
          />
          <div className="flex h-1 w-full overflow-hidden rounded-full bg-muted">
            <span
              aria-hidden
              className={cn(
                "h-full rounded-full",
                over ? "bg-destructive" : "bg-primary",
              )}
              style={{
                inlineSize: `${Math.min(
                  (text.length / KEYWORD_FIELD_CHAR_LIMIT) * 100,
                  100,
                )}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-caption">
            <span className="text-muted-foreground">
              Separate keywords with commas.
            </span>
            <span
              id="keyword-field-count"
              aria-live="polite"
              className={cn(
                "numeric font-mono",
                over ? "font-medium text-destructive" : "text-muted-foreground",
              )}
            >
              {text.length}/{KEYWORD_FIELD_CHAR_LIMIT}
              {over
                ? ` · ${text.length - KEYWORD_FIELD_CHAR_LIMIT} over the limit`
                : ""}
            </span>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div>
            <Button
              disabled={mutation.isPending || text.trim() === "" || over}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {mutation.isPending ? "Saving…" : "Save keyword field"}
            </Button>
          </div>
          {result ? <ResultView result={result} /> : null}
        </CardContent>
      )}
    </Card>
  );
}
