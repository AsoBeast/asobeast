"use client";

import type { Ref } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy-text";
import {
  CONSOLE_NAMES,
  consoleCopy,
  type ListingDraftField,
  type ListingDraftValues,
} from "@/lib/listing-draft";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";

const COPY_REFUSED = "Couldn't copy. Select and copy it manually.";

async function copyWithToast(text: string, copied: string) {
  if (await copyText(text)) toast.success(copied);
  else toast.error(COPY_REFUSED);
}

export function CopyFieldButton({
  field,
  value,
}: {
  field: ListingDraftField;
  value: string;
}) {
  const label = METADATA_FIELD_LABELS[field];
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Copy ${label.toLowerCase()}`}
      onClick={() => void copyWithToast(value, `${label} copied`)}
    >
      <Copy aria-hidden />
    </Button>
  );
}

export function CopyDraftButton({
  ref,
  store,
  values,
  primary,
}: {
  ref?: Ref<HTMLButtonElement>;
  store: Store;
  values: ListingDraftValues;
  primary: boolean;
}) {
  const consoleName = CONSOLE_NAMES[store];
  return (
    <Button
      ref={ref}
      variant={primary ? "default" : "outline"}
      onClick={() =>
        void copyWithToast(
          consoleCopy(store, values),
          `Draft copied for ${consoleName}`,
        )
      }
    >
      <Copy aria-hidden />
      <span>{`Copy for ${consoleName}`}</span>
    </Button>
  );
}
