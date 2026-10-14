"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  SETUP_KEYWORD_TARGET,
  type TrackedKeywordItem,
} from "@asobeast/shared";
import {
  SuggestionList,
  suggestionListState,
} from "@/components/keywords/SuggestionList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addKeywords, ApiError } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { activeKeywordCount } from "@/lib/onboarding";
import {
  invalidateKeywordMutation,
  pickerSuggestionsOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  isPickerStrategy,
  PICKER_LABELS,
  PICKER_STRATEGIES,
  pickerButtonLabel,
  remainingToTarget,
  type PickerStrategy,
} from "./keyword-picker";

const NOTHING_SELECTED: ReadonlySet<string> = new Set();

export function KeywordPicker({
  appId,
  country,
  tracked,
}: {
  appId: string;
  country: string;
  tracked: TrackedKeywordItem[];
}) {
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState<PickerStrategy>("metadata");
  const [selected, setSelected] = useState(NOTHING_SELECTED);
  const suggestions = useQuery(
    pickerSuggestionsOptions(appId, strategy, country),
  );
  const track = useMutation({
    mutationFn: (texts: string[]) => addKeywords(appId, texts, country),
    onSuccess: (_items, texts) => {
      invalidateKeywordMutation(queryClient, appId);
      setSelected(NOTHING_SELECTED);
      toast.success(
        `Tracking ${pluralize(texts.length, "keyword")}. Positions arrive within minutes.`,
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Could not track the selected keywords",
      ),
  });
  const trackOnce = useSingleFlight(track);
  const trackedTexts = new Set(tracked.map((keyword) => keyword.text));
  const remaining = remainingToTarget(
    activeKeywordCount(tracked),
    SETUP_KEYWORD_TARGET,
  );
  const toggle = (text: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(text);
      else next.delete(text);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={strategy}
        onValueChange={(value) => {
          if (!isPickerStrategy(value)) return;
          setStrategy(value);
          setSelected(NOTHING_SELECTED);
        }}
      >
        <TabsList>
          {PICKER_STRATEGIES.map((value) => (
            <TabsTrigger key={value} value={value}>
              {PICKER_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <SuggestionList
        strategy={strategy}
        state={suggestionListState(suggestions)}
        trackedTexts={trackedTexts}
        action={{ kind: "select", selected, onToggle: toggle }}
        onRetry={() => void suggestions.refetch()}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={selected.size === 0 || track.isPending}
          onClick={() => trackOnce([...selected])}
        >
          {track.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {pickerButtonLabel(selected.size)}
        </Button>
        {remaining > 0 ? (
          <span className="text-caption text-muted-foreground">
            {remaining} more to reach {SETUP_KEYWORD_TARGET}
          </span>
        ) : null}
      </div>
    </div>
  );
}
