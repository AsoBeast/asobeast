"use client";

import { useState, type ComponentProps, type RefObject } from "react";
import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { firstFocusable } from "@/lib/focus-handoff";
import { useIsMobile } from "@/lib/use-is-mobile";
import { KeywordFacets } from "./KeywordFacets";

type Facets = ComponentProps<typeof KeywordFacets>;

const FACET_ROWS =
  "flex flex-col gap-1 *:w-full *:justify-between [&>span>button:first-child]:flex-1 [&>span>button:first-child]:justify-between";

function FiltersButton({
  active,
  ...props
}: ComponentProps<typeof Button> & { active: number }) {
  return (
    <Button variant="outline" size="sm" {...props}>
      <ListFilter aria-hidden />
      Filters
      {active > 0 ? (
        <Badge variant="secondary" className="numeric">
          {active}
        </Badge>
      ) : null}
    </Button>
  );
}

interface WidthBoundFilters extends Facets {
  active: number;
  otherWidth: RefObject<HTMLElement | null>;
}

function useWidthBoundOpen(
  fits: boolean,
  otherWidth: RefObject<HTMLElement | null>,
) {
  const [open, setOpen] = useState(false);
  if (open && !fits) setOpen(false);

  const onCloseAutoFocus = (event: Event) => {
    const filters = firstFocusable(otherWidth.current);
    if (!filters?.getClientRects().length) return;
    event.preventDefault();
    filters.focus();
  };

  return { open, setOpen, onCloseAutoFocus };
}

export function KeywordFiltersPopover({
  active,
  otherWidth,
  ...facets
}: WidthBoundFilters) {
  const { open, setOpen, onCloseAutoFocus } = useWidthBoundOpen(
    !useIsMobile(),
    otherWidth,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FiltersButton active={active} />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Filters"
        className="w-60"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <div className={FACET_ROWS}>
          <KeywordFacets {...facets} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function KeywordFiltersSheet({
  active,
  otherWidth,
  ...facets
}: WidthBoundFilters) {
  const { open, setOpen, onCloseAutoFocus } = useWidthBoundOpen(
    useIsMobile(),
    otherWidth,
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <FiltersButton active={active} />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[80svh]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow the keywords by source, bucket, status, type, grade and
            position.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col items-start gap-2">
          <KeywordFacets {...facets} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
