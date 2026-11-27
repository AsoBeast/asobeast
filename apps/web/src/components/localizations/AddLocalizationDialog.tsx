"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { AppLocalizationsResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addableGroups,
  type AddableLocalization,
} from "@/lib/app-localizations";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { apiErrorMessage } from "@/lib/api";
import { useAddLocalization } from "./useAddLocalization";

export function AddLocalizationDialog({
  id,
  result,
}: {
  id: string;
  result: AppLocalizationsResult;
}) {
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  const [open, setOpen] = useState(false);
  const { add, pending, error, reset } = useAddLocalization(id, () =>
    setOpen(false),
  );
  const groups = addableGroups(result.localizations, result.markets);
  const message = error ? apiErrorMessage(error, t("add.failed")) : null;

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) reset();
  }

  const option = ({ localization, readIn }: AddableLocalization) => (
    <CommandItem
      key={localization}
      value={`${localizationNameInLocale(localization, locale)} ${localization}`}
      disabled={pending}
      onSelect={() => add(localization)}
    >
      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
        <span>{localizationNameInLocale(localization, locale)}</span>
        {readIn.length > 0 ? (
          <span className="text-caption text-muted-foreground">
            {t("add.readIn", {
              markets: readIn
                .map((country) => country.toUpperCase())
                .join(", "),
            })}
          </span>
        ) : null}
      </span>
    </CommandItem>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus aria-hidden />
          {t("add.button")}
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("add.title")}</DialogTitle>
          <DialogDescription>{t("add.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Command>
            <CommandInput placeholder={t("add.search")} autoFocus />
            <CommandList>
              <CommandEmpty>{t("add.empty")}</CommandEmpty>
              {groups.read.length > 0 ? (
                <CommandGroup heading={t("add.readMarkets")}>
                  {groups.read.map(option)}
                </CommandGroup>
              ) : null}
              {groups.other.length > 0 ? (
                <CommandGroup heading={t("add.otherLanguages")}>
                  {groups.other.map(option)}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
          {message ? (
            <p role="alert" className="text-dense text-destructive">
              {message}
            </p>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
