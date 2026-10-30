"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { AppLocalizationsResult } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import { Button } from "@/components/ui/button";
import { ApiError, startAppStoreImport } from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { formatList } from "@/lib/format";
import { localizationName } from "@/lib/localizations";
import { seedStoreImport } from "@/lib/queries";
import { apiErrorMessage } from "./api-error-message";

export const STORE_IMPORT_FOCUS_KEY = "keyword-field-import";

function importWarning(names: string[]): string {
  const removals =
    "App Store Connect does not serve every localization, and the ones it does not serve lose their field here. Stopping does not bring them back.";
  if (names.length === 0) {
    return `App Store Connect replaces the keyword fields of every localization it serves. ${removals} The fields become read only here and follow App Store Connect with every release. Stop importing any time to edit them here again.`;
  }
  const list = formatList(names);
  const replaced =
    names.length === 1
      ? `Your ${list} field will be replaced by what App Store Connect serves.`
      : `Your ${list} fields will be replaced by what App Store Connect serves.`;
  return `${replaced} ${removals} The fields become read only here and follow App Store Connect with every release. Stop importing any time to edit them here again.`;
}

function startErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? apiErrorMessage(error, "Could not start the import")
    : "Could not start the import";
}

export function ImportFromStoreButton({
  id,
  result,
}: {
  id: string;
  result: AppLocalizationsResult;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const claimFocus = useFocusClaim(STORE_IMPORT_FOCUS_KEY);
  const typed = result.localizations.filter((item) => item.phrases.length > 0);
  const replaces = importWarning(
    typed.map((item) => localizationName(item.localization)),
  );
  const start = useMutation({
    mutationFn: () => startAppStoreImport(id),
    onSuccess: (next) => {
      seedStoreImport(queryClient, id, next);
      setOpen(false);
    },
  });
  const error = start.error ? startErrorMessage(start.error) : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !start.isPending) start.reset();
        closeUnlessPending(start.isPending, setOpen)(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button ref={claimFocus} variant="outline" size="sm">
          <Download aria-hidden />
          Import from App Store Connect
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import from App Store Connect?</AlertDialogTitle>
          <AlertDialogDescription>{replaces}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <ConfirmActionFooter
          pending={start.isPending}
          label="Import"
          pendingLabel="Importing…"
          variant="default"
          onConfirm={() => {
            armFocusHandoff(STORE_IMPORT_FOCUS_KEY);
            start.mutate();
          }}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
