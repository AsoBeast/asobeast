"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  TrackSelectedButton,
  useTrackSelected,
} from "./TrackSelectedSuggestions";
import { useSuggestionTicks } from "./use-suggestion-ticks";
import { selectionScope } from "./suggestion-selection";
import { strategyOptions } from "./suggestion-strategies";

export function SuggestionsPanel({
  id,
  country,
  store,
}: {
  id: string;
  country: string;
  store: Store;
}) {
  const t = useTranslations("keywords");
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
      toast.success(t("suggestions.trackingOne", { keyword: text }));
    },
    onError: (error, text) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : t("suggestions.trackOneFailed", { keyword: text }),
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

  const listState = suggestionListState(suggestions);
  const strategies = strategyOptions(t);
  const scope = selectionScope(country, strategy);
  const { ticked, toggle, untick } = useSuggestionTicks(
    scope,
    listState.status === "ready"
      ? listState.suggestions.map((suggestion) => suggestion.text)
      : [],
    new Set([...trackedTexts, ...trackingTexts]),
  );
  const bulk = useTrackSelected(id, country, untick);

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
              {t("suggestions.title")}
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
            {t("suggestions.description")}
          </p>
          <Tabs
            value={strategy}
            onValueChange={(value) =>
              setStrategy(value as KeywordSuggestionStrategy)
            }
          >
            <TabsList scrollable>
              {strategies.map((item) => (
                <TabsOption key={item.value} value={item.value}>
                  {item.label}
                </TabsOption>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-caption text-muted-foreground">
              <span>
                {
                  strategies.find((item) => item.value === strategy)
                    ?.description
                }
              </span>
              {liveLookup ? (
                <span>
                  {t("suggestions.liveLookup", {
                    store: storeLabel(store),
                  })}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <SpiderDialog appId={id} country={country}>
                <Button variant="outline" size="sm">
                  <Search />
                  {t("suggestions.deepSearch")}
                </Button>
              </SpiderDialog>
              <TrackSelectedButton
                count={ticked.length}
                busy={bulk.busy}
                onTrack={() => bulk.trackOnce({ texts: ticked, scope })}
              />
            </div>
          </div>

          <SuggestionList
            strategy={strategy}
            state={listState}
            trackedTexts={trackedTexts}
            action={{
              kind: "trackOrSelect",
              pending: new Set([...trackingTexts, ...bulk.sending]),
              onTrack: trackOnce,
              selected: new Set(ticked),
              onToggle: toggle,
            }}
            onRetry={() => void suggestions.refetch()}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
