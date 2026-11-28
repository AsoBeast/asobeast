"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function DescriptionFold({
  open,
  onOpenChange,
  count,
  changed,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: string;
  changed: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2 w-fit">
            <ChevronRight
              aria-hidden
              className="transition-transform duration-150 ease-out data-[open=true]:rotate-90"
              data-open={open}
            />
            <span>Description</span>
          </Button>
        </CollapsibleTrigger>
        {open ? null : (
          <span className="flex items-baseline gap-2">
            {changed ? (
              <span className="text-caption text-muted-foreground">
                Changed
              </span>
            ) : null}
            <span className="numeric text-label text-faint-foreground">
              {count}
            </span>
          </span>
        )}
      </div>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
