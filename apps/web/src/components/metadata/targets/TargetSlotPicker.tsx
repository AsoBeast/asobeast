"use client";

import { useState, type Ref } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import type { ListingTargetCandidate } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  openCandidates,
  slotHolding,
  slotLabel,
  targetPhrase,
  type TargetSlots,
} from "@/lib/listing-targets";
import { TargetFigures } from "./TargetFigures";

function TypedPhrase({
  phrase,
  holder,
  onPick,
}: {
  phrase: string;
  holder: number | null;
  onPick: (text: string) => void;
}) {
  if (holder !== null) {
    return (
      <CommandItem forceMount disabled value={`held ${phrase}`}>
        <span translate="no" dir="auto" className="truncate">
          {`“${phrase}” is already in ${slotLabel(holder)}`}
        </span>
      </CommandItem>
    );
  }
  return (
    <CommandItem
      forceMount
      value={`track ${phrase}`}
      onSelect={() => onPick(phrase)}
    >
      <Plus aria-hidden className="size-4" />
      <span translate="no" dir="auto" className="truncate">
        {`Track “${phrase}”`}
      </span>
    </CommandItem>
  );
}

export function TargetSlotPicker({
  index,
  value,
  slots,
  candidates,
  onPick,
  ref,
}: {
  index: number;
  value: string | null;
  slots: TargetSlots;
  candidates: readonly ListingTargetCandidate[];
  onPick: (text: string) => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const label = slotLabel(index);
  const offered = openCandidates(candidates, slots);
  const phrase = targetPhrase(typed);
  const known = phrase !== null && offered.some(({ text }) => text === phrase);
  const shown = value ?? "Choose a keyword";

  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) setTyped("");
  };
  const pick = (text: string) => {
    onPick(text);
    toggle(false);
  };

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          aria-label={`${shown} for ${label}`}
          className="min-w-0 flex-1 justify-between gap-2"
        >
          <span
            translate="no"
            dir="auto"
            className={value ? "truncate" : "truncate text-muted-foreground"}
          >
            {shown}
          </span>
          <ChevronsUpDown aria-hidden className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`Choose the ${label} keyword`}
        className="w-80 p-0"
        align="start"
      >
        <Command>
          <CommandInput
            value={typed}
            onValueChange={setTyped}
            placeholder="Search or type a keyword…"
          />
          <CommandList>
            {phrase === null ? (
              <CommandEmpty>No tracked keyword matches.</CommandEmpty>
            ) : null}
            <CommandGroup>
              {offered.map((candidate) => (
                <CommandItem
                  key={candidate.text}
                  value={candidate.text}
                  onSelect={() => pick(candidate.text)}
                  className="justify-between"
                >
                  <span translate="no" dir="auto" className="truncate">
                    {candidate.text}
                  </span>
                  <TargetFigures scores={candidate.lead} />
                </CommandItem>
              ))}
            </CommandGroup>
            {phrase !== null && !known ? (
              <CommandGroup forceMount>
                <TypedPhrase
                  phrase={phrase}
                  holder={slotHolding(slots, phrase)}
                  onPick={pick}
                />
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
