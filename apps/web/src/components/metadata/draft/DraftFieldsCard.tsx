"use client";

import { useId, useRef, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { Store } from "@asobeast/shared";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ListingDraftValues } from "@/lib/listing-draft";
import { CopyDraftButton } from "./CopyDraftButtons";
import { changedFieldsLine } from "./DraftVerdict";
import { undoToast } from "./undo-toast";

export function DraftFieldsCard({
  store,
  values,
  changed,
  onReset,
  children,
}: {
  store: Store;
  values: ListingDraftValues;
  changed: number;
  onReset: () => () => void;
  children: ReactNode;
}) {
  const headingId = useId();
  const copyRef = useRef<HTMLButtonElement>(null);

  return (
    <section
      aria-labelledby={headingId}
      className="col-span-12 min-w-0 @4xl/metadata:col-span-7"
    >
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>Draft listing</h2>
          </CardTitle>
          <CardAction>
            <span role="status" className="text-dense text-muted-foreground">
              {changed > 0
                ? changedFieldsLine(changed)
                : "Matches the live listing"}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">{children}</CardContent>
        <CardFooter className="flex-wrap">
          <CopyDraftButton
            ref={copyRef}
            store={store}
            values={values}
            primary={changed > 0}
          />
          {changed > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                copyRef.current?.focus();
                undoToast("Draft reset to the live listing", onReset());
              }}
            >
              <RotateCcw aria-hidden />
              <span>Reset to live listing</span>
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
