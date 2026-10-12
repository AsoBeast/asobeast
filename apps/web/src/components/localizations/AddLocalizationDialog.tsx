"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type {
  AppLocalizationsResult,
  AppStoreLocalization,
} from "@asobeast/shared";
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
import { addAppLocalization } from "@/lib/api";
import {
  addableGroups,
  type AddableLocalization,
  upsertLocalization,
} from "@/lib/app-localizations";
import { localizationName } from "@/lib/localizations";
import { appKeys, invalidateLocalizationMutation } from "@/lib/queries";
import { fieldLocaleParser } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";
import { apiErrorMessage } from "./api-error-message";

export function AddLocalizationDialog({
  id,
  result,
}: {
  id: string;
  result: AppLocalizationsResult;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFieldLocale] = useQueryState("fieldLocale", fieldLocaleParser);
  const groups = addableGroups(result.localizations, result.markets);

  const add = useMutation({
    mutationFn: (localization: AppStoreLocalization) =>
      addAppLocalization(id, { localization }),
    onSuccess: (item) => {
      queryClient.setQueryData<AppLocalizationsResult>(
        appKeys.localizations(id),
        (current) => current && upsertLocalization(current, item),
      );
      invalidateLocalizationMutation(queryClient, id);
      setOpen(false);
      void setFieldLocale(item.localization, { history: "replace" });
      toast.success(`Added ${localizationName(item.localization)}`);
    },
    onError: (err) =>
      setError(apiErrorMessage(err, "Could not add the localization")),
  });
  const addOnce = useSingleFlight(add);

  function onOpenChange(next: boolean) {
    if (add.isPending) return;
    setOpen(next);
    if (!next) {
      setError(null);
      add.reset();
    }
  }

  const option = ({ localization, readIn }: AddableLocalization) => (
    <CommandItem
      key={localization}
      value={`${localizationName(localization)} ${localization}`}
      disabled={add.isPending}
      onSelect={() => {
        setError(null);
        addOnce(localization);
      }}
    >
      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
        <span>{localizationName(localization)}</span>
        {readIn.length > 0 ? (
          <span className="text-caption text-muted-foreground">
            Read in {readIn.map((country) => country.toUpperCase()).join(", ")}
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
          Add localization
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Add a localization</DialogTitle>
          <DialogDescription>
            Pick a language you ship in App Store Connect. Its keyword field is
            read in every storefront on its list.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Command>
            <CommandInput placeholder="Search languages" autoFocus />
            <CommandList>
              <CommandEmpty>No language found.</CommandEmpty>
              {groups.read.length > 0 ? (
                <CommandGroup heading="Read in your markets">
                  {groups.read.map(option)}
                </CommandGroup>
              ) : null}
              {groups.other.length > 0 ? (
                <CommandGroup heading="Other languages">
                  {groups.other.map(option)}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
