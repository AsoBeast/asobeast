"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectTopLabel, topIdeas } from "./ideas-selection";
import { SuggestionList, type SuggestionListState } from "./SuggestionList";
import {
  TrackSelectedButton,
  useTrackSelected,
} from "./TrackSelectedSuggestions";
import { selectionScope } from "./suggestion-selection";
import type { IdeasStatus } from "./use-ideas-status";
import { useSuggestionTicks } from "./use-suggestion-ticks";

function listState(status: IdeasStatus): SuggestionListState {
  return status.failed
    ? { status: "error", error: status.error }
    : { status: "ready", suggestions: status.found };
}

export function IdeasResults({
  id,
  country,
  seed,
  status,
}: {
  id: string;
  country: string;
  seed: string;
  status: IdeasStatus;
}) {
  const { found, trackedTexts, complete } = status;
  const scope = `${selectionScope(country, "search")}:ideas:${seed}`;
  const { ticked, toggle, untick } = useSuggestionTicks(
    scope,
    found.map((suggestion) => suggestion.text),
    trackedTexts,
  );
  const bulk = useTrackSelected(id, country, untick);
  const top = topIdeas(found, trackedTexts);
  const waiting = !status.failed && !complete && found.length === 0;

  return (
    <>
      <div className="numeric flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
        <span>{complete ? "Complete" : "Searching…"}</span>
        <span>{`${status.probesDone}/${status.probesTotal}`}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {top.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              for (const text of top) toggle(text, true);
            }}
          >
            <Plus />
            {selectTopLabel(top.length)}
          </Button>
        ) : null}
        <TrackSelectedButton
          count={ticked.length}
          busy={bulk.busy}
          onTrack={() => bulk.trackOnce({ texts: ticked, scope })}
        />
      </div>
      {waiting ? (
        <p className="text-body text-muted-foreground">
          Waiting for the first results…
        </p>
      ) : (
        <SuggestionList
          strategy="search"
          state={listState(status)}
          trackedTexts={trackedTexts}
          action={{
            kind: "select",
            selected: new Set(ticked),
            onToggle: toggle,
          }}
          onRetry={status.retry}
        />
      )}
    </>
  );
}
