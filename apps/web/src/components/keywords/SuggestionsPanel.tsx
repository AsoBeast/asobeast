"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import type { KeywordSuggestionStrategy } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addKeywords, ApiError } from "@/lib/api";
import {
  invalidateKeywordMutation,
  keywordsOptions,
  suggestionsOptions,
} from "@/lib/queries";
import { sortParser, suggestionStrategyParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { SpiderDialog } from "./SpiderDialog";
import { SuggestionList } from "./SuggestionList";
import { STRATEGIES } from "./suggestion-strategies";

export function SuggestionsPanel({
  id,
  country,
}: {
  id: string;
  country: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useQueryState(
    "strategy",
    suggestionStrategyParser,
  );
  const [sort] = useQueryState("sort", sortParser);

  const tracked = useQuery(keywordsOptions(id, sort, country));
  const trackedTexts = new Set(
    (tracked.data ?? []).map((keyword) => keyword.text),
  );

  const suggestions = useQuery({
    ...suggestionsOptions(id, strategy, country),
    enabled: open,
  });

  const track = useMutation({
    mutationFn: (text: string) => addKeywords(id, [text], country),
    onSuccess: (_data, text) => {
      invalidateKeywordMutation(queryClient, id);
      toast.success(`Tracking ${text}`);
    },
    onError: (error, text) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : `Could not track ${text}`,
      ),
  });

  const state = suggestions.isPending
    ? ({ status: "pending" } as const)
    : suggestions.isError
      ? ({ status: "error", error: suggestions.error } as const)
      : ({ status: "ready", suggestions: suggestions.data } as const);

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <div className="flex flex-col gap-1">
            <CardTitle>Suggestions</CardTitle>
            <CardDescription>
              Search and Similar apps query the App Store live, so results can
              take a few seconds.
            </CardDescription>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </CardHeader>

      {open ? (
        <CardContent className="flex flex-col gap-4">
          <Tabs
            value={strategy}
            onValueChange={(value) =>
              setStrategy(value as KeywordSuggestionStrategy)
            }
          >
            <TabsList>
              {STRATEGIES.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-between gap-4">
            <p className="text-caption text-muted-foreground">
              {STRATEGIES.find((item) => item.value === strategy)?.description}
            </p>
            <SpiderDialog appId={id} country={country}>
              <Button variant="outline" size="sm">
                <Search />
                Deep search
              </Button>
            </SpiderDialog>
          </div>

          <SuggestionList
            strategy={strategy}
            state={state}
            trackedTexts={trackedTexts}
            pendingText={track.isPending ? track.variables : undefined}
            onTrack={(text) => track.mutate(text)}
            onRetry={() => void suggestions.refetch()}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
