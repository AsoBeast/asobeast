"use client";

import { useId } from "react";
import type { PlacementSuggestion } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { GradedNumber } from "@/components/ui/graded";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { grade } from "@/lib/grade";
import { PLACEMENT_LABELS, placementSentence } from "@/lib/placement";

export function PlacementChip({
  subject,
  suggestion,
  relevance,
}: {
  subject: string;
  suggestion: PlacementSuggestion;
  relevance: number | null;
}) {
  const titleId = useId();
  const label = PLACEMENT_LABELS[suggestion.field];
  const parts = placementSentence(suggestion, relevance);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Suggested: ${label}. Why ${subject} belongs there`}
          className="inline-flex shrink-0 rounded-md"
        >
          <Badge
            aria-hidden
            variant={suggestion.field === "skip" ? "flat" : "outline"}
          >
            {label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-labelledby={titleId}
        collisionPadding={16}
        className="w-80 max-w-(--radix-popover-content-available-width) text-body"
      >
        <PopoverHeader>
          <PopoverTitle id={titleId} className="wrap-anywhere">
            {`Where ${subject} belongs`}
          </PopoverTitle>
        </PopoverHeader>
        <p className="text-muted-foreground">
          {parts.map((part, index) =>
            typeof part === "string" ? (
              <span key={index}>{part}</span>
            ) : (
              <GradedNumber
                key={index}
                value={part.shown}
                grade={grade(part.metric, part.value)}
                label={part.label}
                className="text-foreground"
              />
            ),
          )}
        </p>
      </PopoverContent>
    </Popover>
  );
}
