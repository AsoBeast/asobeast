"use client";

import { useRef, useState, type ComponentProps, type RefObject } from "react";
import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/lib/use-is-mobile";
import { KeywordFacets } from "./KeywordFacets";

const isRendered = (element: HTMLElement | null): boolean =>
  (element?.getClientRects().length ?? 0) > 0;

const firstControl = (group: HTMLElement | null): HTMLElement | null =>
  group?.querySelector<HTMLElement>('button:not([aria-disabled="true"])') ??
  null;

export function KeywordFiltersSheet({
  active,
  inlineFacets,
  ...facets
}: ComponentProps<typeof KeywordFacets> & {
  active: number;
  inlineFacets: RefObject<HTMLElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();
  if (open && !isMobile) setOpen(false);

  const onCloseAutoFocus = (event: Event) => {
    if (isRendered(trigger.current)) return;
    event.preventDefault();
    firstControl(inlineFacets.current)?.focus();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button ref={trigger} variant="outline" size="sm">
          <ListFilter aria-hidden />
          Filters
          {active > 0 ? (
            <Badge variant="secondary" className="numeric font-mono">
              {active}
            </Badge>
          ) : null}
        </Button>
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
