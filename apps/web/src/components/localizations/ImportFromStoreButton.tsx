"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
import { ApiError, startAppStoreImport, apiErrorMessage } from "@/lib/api";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { formatListInLocale } from "@/lib/format";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { seedStoreImport } from "@/lib/queries";

export const STORE_IMPORT_FOCUS_KEY = "keyword-field-import";

function importWarning(
  names: string[],
  t: MessageTranslator,
  locale: Locale,
): string {
  const removals = t("import.removals");
  if (names.length === 0) {
    return t("import.all", { removals });
  }
  const list = formatListInLocale(names, locale);
  return t(names.length === 1 ? "import.one" : "import.many", {
    names: list,
    removals,
  });
}

function startErrorMessage(error: unknown, t: MessageTranslator): string {
  return error instanceof ApiError
    ? apiErrorMessage(error, t("import.failed"))
    : t("import.failed");
}

export function ImportFromStoreButton({
  id,
  result,
}: {
  id: string;
  result: AppLocalizationsResult;
}) {
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const claimFocus = useFocusClaim(STORE_IMPORT_FOCUS_KEY);
  const typed = result.localizations.filter((item) => item.phrases.length > 0);
  const replaces = importWarning(
    typed.map((item) => localizationNameInLocale(item.localization, locale)),
    t,
    locale,
  );
  const start = useMutation({
    mutationFn: () => startAppStoreImport(id),
    onSuccess: (next) => {
      seedStoreImport(queryClient, id, next);
      setOpen(false);
    },
  });
  const error = start.error ? startErrorMessage(start.error, t) : null;

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
          {t("import.button")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("import.title")}</AlertDialogTitle>
          <AlertDialogDescription>{replaces}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-dense text-destructive">
            {error}
          </p>
        ) : null}
        <ConfirmActionFooter
          pending={start.isPending}
          label={t("import.confirm")}
          pendingLabel={t("import.pending")}
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
