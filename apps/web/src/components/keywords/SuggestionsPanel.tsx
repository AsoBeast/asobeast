"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import { useQueryState } from "nuqs";
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
import { storeLabel } from "@/lib/format";
import { keywordsOptions, suggestionsOptions } from "@/lib/queries";
import { suggestionStrategyParser } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { KeywordIdeas } from "./KeywordIdeas";
import { SpiderDialog } from "./SpiderDialog";
import { SuggestionList, suggestionListState } from "./SuggestionList";
import {
  TrackSelectedButton,
  useTrackSelected,
} from "./TrackSelectedSuggestions";
import { useIdeasSeed } from "./use-ideas-seed";
import { useTrackSuggestion } from "./use-track-suggestion";
import { useSuggestionTicks } from "./use-suggestion-ticks";
import { selectionScope } from "./suggestion-selection";
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
  const [strategy, setStrategy] = useQueryState(
    "strategy",
    suggestionStrategyParser,
  );
  const { seed, seeded, sectionToggle, close: closeIdeas } = useIdeasSeed();
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
    enabled: open && !seeded,
  });

  const { trackOnce, trackingTexts } = useTrackSuggestion(id, country);

  const listState = suggestionListState(suggestions);
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
              ref={sectionToggle}
              onClick={() =>
                seeded ? closeIdeas() : setOpen((value) => !value)
              }
              aria-expanded={open || seeded}
              className={SECTION_TOGGLE}
            >
              Suggestions
              <ChevronDown
                aria-hidden
                className={cn(
                  SECTION_CHEVRON,
                  !(open || seeded) && "-rotate-90",
                )}
              />
            </button>
          </h2>
        </CardTitle>
      </CardHeader>

      {seeded ? (
        <CardContent className="flex flex-col gap-4">
          <KeywordIdeas
            id={id}
            country={country}
            seed={seed}
            onClose={closeIdeas}
          />
        </CardContent>
      ) : open ? (
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

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
            <div className="flex flex-wrap gap-2">
              <SpiderDialog appId={id} country={country}>
                <Button variant="outline" size="sm">
                  <Search />
                  Deep search
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
