"use client";

import { Check, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface FacetOption<T extends string> {
  value: T;
  label: string;
  swatch?: string;
}

export function FacetFilter<T extends string>({
  title,
  options,
  selected,
  counts,
  onChange,
}: {
  title: string;
  options: ReadonlyArray<FacetOption<T>>;
  selected: readonly T[];
  counts: ReadonlyMap<unknown, number>;
  onChange: (next: T[]) => void;
}) {
  const toggle = (value: T) =>
    onChange(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-dashed"
          aria-label={`Filter by ${title.toLowerCase()}`}
        >
          <ListFilter aria-hidden />
          {title}
          {selected.length > 0 ? (
            <Badge variant="secondary" className="numeric font-mono">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <Command>
          <CommandInput
            placeholder={title}
            aria-label={`Search ${title.toLowerCase()}`}
          />
          <CommandList>
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    aria-checked={checked}
                    onSelect={() => toggle(option.value)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[4px] border border-input",
                        checked &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {checked ? <Check className="size-3" /> : null}
                    </span>
                    {option.swatch ? (
                      <span
                        aria-hidden
                        className={cn("size-2 rounded-full", option.swatch)}
                      />
                    ) : null}
                    {option.label}
                    <span className="ml-auto numeric font-mono text-xs text-muted-foreground">
                      {counts.get(option.value) ?? 0}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="justify-center"
                  >
                    Clear
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
