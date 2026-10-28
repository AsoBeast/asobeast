"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const CONFIRM_DROPS_LABEL = "Confirm drops before alerting";
export const CONFIRM_DROPS_BADGE = "Confirmed drops";
export const CONFIRM_DROPS_HELP =
  "A rank drop, or an exit from the top 10, the top 3 or first place, is sent only if the next check confirms it. A keyword that slips from #9 to #11 and comes back sends nothing. Confirmed drops arrive one check later.";

export function ConfirmDropsField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        aria-describedby={helpId}
        className="mt-0.5"
        onCheckedChange={(value) => onChange(value === true)}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={id}>{CONFIRM_DROPS_LABEL}</Label>
        <p id={helpId} className="text-sm text-muted-foreground">
          {CONFIRM_DROPS_HELP}
        </p>
      </div>
    </div>
  );
}
