"use client";

import { useId, type ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function InfoTip({
  label,
  title,
  summary,
  className,
  children,
}: {
  label: string;
  title: string;
  summary: string;
  className?: string;
  children?: ReactNode;
}) {
  const titleId = useId();
  const summaryId = useId();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          data-slot="info-tip-trigger"
          className={cn(
            "-my-1 text-muted-foreground hover:text-foreground print:hidden",
            className,
          )}
        >
          <InfoIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        collisionPadding={16}
        className="w-80 max-w-(--radix-popover-content-available-width) text-body"
      >
        <PopoverHeader>
          <PopoverTitle id={titleId}>{title}</PopoverTitle>
          <PopoverDescription id={summaryId}>{summary}</PopoverDescription>
        </PopoverHeader>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export { InfoTip };
