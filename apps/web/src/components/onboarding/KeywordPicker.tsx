"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  NOTHING_TICKED,
  trackingSelectedMessage,
  trackSelectedLabel,
  withTick,
} from "@/components/keywords/suggestion-selection";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { addKeywords, ApiError } from "@/lib/api";
import {
  invalidateKeywordMutation,
  pickerSuggestionsOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { activeKeywordCount } from "./setup-progress";
import {
  isPickerStrategy,
  PICKER_STRATEGIES,
  remainingToTarget,
  type PickerStrategy,
} from "./keyword-picker";

export function KeywordPicker({
  appId,
  country,
  tracked,
}: {
  appId: string;
  country: string;
  tracked: TrackedKeywordItem[];
}) {
  const t = useTranslations("setup");
  const tKeywords = useTranslations("keywords");
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState<PickerStrategy>("metadata");
  const [selected, setSelected] = useState(NOTHING_TICKED);
  const suggestions = useQuery(
    pickerSuggestionsOptions(appId, strategy, country),
  );
  const track = useMutation({
    mutationFn: (texts: string[]) => addKeywords(appId, texts, country),
    onSuccess: (_items, texts) => {
      invalidateKeywordMutation(queryClient, appId);
      setSelected(NOTHING_TICKED);
      toast.success(trackingSelectedMessage(texts.length, tKeywords));
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : tKeywords("suggestions.trackSelectedFailed"),
      ),
  });
  const trackOnce = useSingleFlight(track);
  const trackedTexts = new Set(tracked.map((keyword) => keyword.text));
  const remaining = remainingToTarget(
    activeKeywordCount(tracked),
    SETUP_KEYWORD_TARGET,
  );
  const toggle = (text: string, on: boolean) =>
    setSelected((current) => withTick(current, text, on));

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={strategy}
        onValueChange={(value) => {
          if (!isPickerStrategy(value)) return;
          setStrategy(value);
          setSelected(NOTHING_TICKED);
        }}
      >
        <TabsList scrollable>
          {PICKER_STRATEGIES.map((value) => (
            <TabsOption key={value} value={value}>
              {t(`keywordPicker.${value}`)}
            </TabsOption>
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
          variant="outline"
          aria-disabled={selected.size === 0 || track.isPending || undefined}
          onClick={() => {
            if (selected.size > 0) trackOnce([...selected]);
          }}
        >
          {track.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {trackSelectedLabel(selected.size, tKeywords)}
        </Button>
        {remaining > 0 ? (
          <span className="text-caption text-muted-foreground">
            {t("keywordPicker.remaining", {
              count: remaining,
              target: SETUP_KEYWORD_TARGET,
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
