"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import type {
  AppLocalizationItem,
  AppLocalizationsResult,
} from "@asobeast/shared";
import {
  closeUnlessPending,
  ConfirmActionFooter,
} from "@/components/ConfirmActionFooter";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { removeAppLocalization, apiErrorMessage } from "@/lib/api";
import {
  removeDescription,
  withoutLocalization,
} from "@/lib/app-localizations";
import { siblingControl, useCloseFocusHandoff } from "@/lib/focus-handoff";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { fieldLocaleParser } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";

const LOCALIZATION_ITEM = '[data-slot="accordion-item"]';
const LOCALIZATION_TRIGGER = '[data-slot="accordion-trigger"]';

export function RemoveLocalizationDialog({
  id,
  item,
}: {
  id: string;
  item: AppLocalizationItem;
}) {
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fieldLocale, setFieldLocale] = useQueryState(
    "fieldLocale",
    fieldLocaleParser,
  );
  const name = localizationNameInLocale(item.localization, locale);
  const opener = useRef<HTMLButtonElement>(null);
  const { handOff, onCloseAutoFocus } = useCloseFocusHandoff();

  const remove = useMutation({
    mutationFn: () => removeAppLocalization(id, item.localization),
    onSuccess: () => {
      handOff(
        siblingControl(
          opener.current?.closest(LOCALIZATION_ITEM) ?? null,
          LOCALIZATION_TRIGGER,
        ),
      );
      queryClient.setQueryData<AppLocalizationsResult>(
        appKeys.localizations(id),
        (current) => current && withoutLocalization(current, item.localization),
      );
      invalidateLocalizationMutation(queryClient, id);
      setOpen(false);
      if (fieldLocale === item.localization) {
        void setFieldLocale(null, { history: "replace" });
      }
      toast.success(t("remove.removed", { name }));
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, t("remove.failed", { name }))),
  });
  const removeOnce = useSingleFlight(remove);

  return (
    <AlertDialog
      open={open}
      onOpenChange={closeUnlessPending(remove.isPending, setOpen)}
    >
      <AlertDialogTrigger asChild>
        <Button
          ref={opener}
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
        >
          {t("remove.button")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("remove.title", { name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {removeDescription(item, t, locale)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ConfirmActionFooter
          pending={remove.isPending}
          label={t("remove.confirm")}
          pendingLabel={t("remove.pending")}
          onConfirm={removeOnce}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
