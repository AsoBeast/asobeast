"use client";

import { useRef, type RefCallback } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type {
  ListingTargetCandidate,
  PlacementSuggestion,
  TargetScores,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  armFocusHandoff,
  useFocusAfterCommit,
  useFocusClaim,
} from "@/lib/focus-handoff";
import {
  slotLabel,
  untrackedLine,
  type TargetSlots,
} from "@/lib/listing-targets";
import { PlacementChip } from "./PlacementChip";
import { TargetFigures } from "./TargetFigures";
import { TargetSlotPicker } from "./TargetSlotPicker";

type Way = "up" | "down";

const moveKey = (way: Way, phrase: string | null) =>
  `listing-target-move:${way}:${phrase ?? ""}`;

function MoveButton({
  way,
  phrase,
  to,
  slots,
  claim,
  onMove,
}: {
  way: Way;
  phrase: string;
  to: number;
  slots: TargetSlots;
  claim: RefCallback<HTMLElement>;
  onMove: (to: number) => void;
}) {
  const blocked = to < 0 || to >= slots.length;
  const Icon = way === "up" ? ArrowUp : ArrowDown;
  return (
    <Button
      ref={claim}
      variant="ghost"
      size="icon"
      aria-label={`Move ${phrase} ${way}`}
      aria-disabled={blocked || undefined}
      onClick={() => {
        if (blocked) return;
        armFocusHandoff(moveKey(way, phrase));
        onMove(to);
      }}
    >
      <Icon aria-hidden />
    </Button>
  );
}

export function TargetSlot({
  index,
  slots,
  candidates,
  scores,
  placement,
  untrackedIn,
  onChange,
  onMove,
}: {
  index: number;
  slots: TargetSlots;
  candidates: readonly ListingTargetCandidate[];
  scores: TargetScores | undefined;
  placement: PlacementSuggestion | undefined;
  untrackedIn: readonly string[];
  onChange: (text: string | null) => void;
  onMove: (to: number) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const focusAfter = useFocusAfterCommit();
  const value = slots[index];
  const label = slotLabel(index);
  const untracked = untrackedLine(untrackedIn);
  const claimUp = useFocusClaim(moveKey("up", value));
  const claimDown = useFocusClaim(moveKey("down", value));

  return (
    <li
      aria-label={label}
      className="flex min-w-0 flex-col gap-1.5 rounded-md p-2"
    >
      <span className="text-label text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <TargetSlotPicker
          ref={trigger}
          index={index}
          value={value}
          slots={slots}
          candidates={candidates}
          onPick={onChange}
        />
        {value === null ? null : (
          <>
            <MoveButton
              way="up"
              phrase={value}
              to={index - 1}
              slots={slots}
              claim={claimUp}
              onMove={onMove}
            />
            <MoveButton
              way="down"
              phrase={value}
              to={index + 1}
              slots={slots}
              claim={claimDown}
              onMove={onMove}
            />
          </>
        )}
        {value === null ? null : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${value} from ${label}`}
            onClick={(event) => {
              focusAfter(trigger.current, event.currentTarget);
              onChange(null);
            }}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1">
        {value !== null && placement ? (
          <PlacementChip
            subject={value}
            suggestion={placement}
            relevance={scores?.relevance ?? null}
          />
        ) : null}
        {value !== null && scores ? <TargetFigures scores={scores} /> : null}
        {untracked ? (
          <span className="text-caption text-muted-foreground">
            {untracked}
          </span>
        ) : null}
      </div>
    </li>
  );
}
