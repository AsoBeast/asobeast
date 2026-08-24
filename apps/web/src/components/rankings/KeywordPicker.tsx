"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { keywordsOptions } from "@/lib/queries";
import { DEFAULT_SELECTION, topByOpportunity } from "./selection";

export function KeywordPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: tracked } = useSuspenseQuery(keywordsOptions(id));

  const toggle = (keywordId: string) => {
    onChange(
      value.includes(keywordId)
        ? value.filter((item) => item !== keywordId)
        : [...value, keywordId],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-2">
          {value.length} selected
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search keywords…" />
          <CommandList>
            <CommandEmpty>No keywords found.</CommandEmpty>
            <CommandGroup>
              {tracked.map((keyword) => (
                <CommandItem
                  key={keyword.keywordId}
                  value={keyword.text}
                  onSelect={() => toggle(keyword.keywordId)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      value.includes(keyword.keywordId)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">{keyword.text}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() =>
                  onChange(topByOpportunity(tracked, DEFAULT_SELECTION))
                }
              >
                Top {DEFAULT_SELECTION} by opportunity
              </CommandItem>
              <CommandItem onSelect={() => onChange([])}>Clear</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
