"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSectionOpen } from "./CollapsedSections";

export function CollapsibleCard({
  section,
  title,
  eyebrow,
  actions,
  children,
}: {
  section: string;
  title: string;
  eyebrow: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const [open, setOpen] = useSectionOpen(section);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card data-slot="card" role="region" aria-labelledby={titleId}>
        <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardDescription>{eyebrow}</CardDescription>
            <CardTitle asChild>
              <h2 id={titleId}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group/section inline-flex max-w-full items-center gap-2 rounded-sm text-left hover:underline hover:decoration-primary hover:underline-offset-4"
                  >
                    {title}
                    <ChevronDown
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]/section:-rotate-90 motion-reduce:transition-none"
                    />
                  </button>
                </CollapsibleTrigger>
              </h2>
            </CardTitle>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </CardHeader>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
