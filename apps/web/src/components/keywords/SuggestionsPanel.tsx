"use client";

import { useCallback, useState } from "react";
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  isStoreSuggestionStrategy,
  type KeywordSuggestionStrategy,
  type Store,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SECTION_CHEVRON,
  SECTION_TOGGLE,
} from "@/components/layout/panel-classes";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { addKeywords, ApiError } from "@/lib/api";
import { storeLabel } from "@/lib/format";
import {
  invalidateKeywordMutation,
  keywordsOptions,
  suggestionsOptions,
} from "@/lib/queries";
import { suggestionStrategyParser } from "@/lib/search-params";
import { useKeyedSingleFlight } from "@/lib/single-flight";
import { cn } from "@/lib/utils";
import { SpiderDialog } from "./SpiderDialog";
import { SuggestionList, suggestionListState } from "./SuggestionList";
import { STRATEGIES } from "./suggestion-strategies";

export function SuggestionsPanel({
  id,
  country,
  store,
}: {
  id: string;
  country: string;
  store: Store;
}) {
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useQueryState(
    "strategy",
    suggestionStrategyParser,
  );
  const liveLookup = isStoreSuggestionStrategy(strategy);

  const tracked = useQuery(keywordsOptions(id, country));
  const [open, setOpen] = useState(
    () => tracked.data?.length === 0 && !liveLookup,
  );
  const trackedTexts = new Set(
    (tracked.data ?? []).map((keyword) => keyword.text),
  );

  const suggestions = useQuery({
    ...suggestionsOptions(id, strategy, country),
    enabled: open,
  });

  const trackKey = ["track-suggestion", id, country] as const;
  const track = useMutation({
    mutationKey: trackKey,
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
  const trackKeyOf = useCallback(
    (text: string) => JSON.stringify([id, country, text]),
    [id, country],
  );
  const trackOnce = useKeyedSingleFlight(track, trackKeyOf);
  const trackingTexts = useMutationState({
    filters: { mutationKey: trackKey, status: "pending" },
    select: (mutation) => mutation.state.variables,
  }).filter((text): text is string => typeof text === "string");

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className={SECTION_TOGGLE}
            >
              Suggestions
              <ChevronDown
                aria-hidden
                className={cn(SECTION_CHEVRON, !open && "-rotate-90")}
              />
            </button>
          </h2>
        </CardTitle>
      </CardHeader>

      {open ? (
        <CardContent className="flex flex-col gap-4">
          <p className="text-body text-muted-foreground">
            Phrases from your listing, your competitors, your reviews and store
            search that you do not track yet.
          </p>
          <Tabs
            value={strategy}
            onValueChange={(value) =>
              setStrategy(value as KeywordSuggestionStrategy)
            }
          >
            <TabsList scrollable>
              {STRATEGIES.map((item) => (
                <TabsOption key={item.value} value={item.value}>
                  {item.label}
                </TabsOption>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center justify-between gap-4">
            <p className="text-caption text-muted-foreground">
              <span>
                {
                  STRATEGIES.find((item) => item.value === strategy)
                    ?.description
                }
              </span>
              {liveLookup ? (
                <span>{`. Runs a live ${storeLabel(store)} lookup, so it can take a few seconds.`}</span>
              ) : null}
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
            state={suggestionListState(suggestions)}
            trackedTexts={trackedTexts}
            action={{
              kind: "track",
              pending: new Set(trackingTexts),
              onTrack: trackOnce,
            }}
            onRetry={() => void suggestions.refetch()}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
