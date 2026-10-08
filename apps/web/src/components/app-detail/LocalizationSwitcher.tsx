"use client";

import {
  isAppStoreLocalization,
  storefrontLocalizations,
} from "@asobeast/shared";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localizationName } from "@/lib/localizations";
import { useLocalization } from "./use-localization";

const DEFAULT_VALUE = "default";

export function LocalizationSwitcher({ id }: { id: string }) {
  const { market, captured, localization, select } = useLocalization(id);
  if (captured.length === 0) return null;
  const primary = storefrontLocalizations(market)?.primary;
  const defaultLabel = `${primary ? localizationName(primary) : market.toUpperCase()} · default`;
  const value = localization ?? DEFAULT_VALUE;

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Label htmlFor={`localization-${id}`}>Localization</Label>
      <Select
        value={value}
        onValueChange={(next) =>
          select(isAppStoreLocalization(next) ? next : null)
        }
      >
        <SelectTrigger id={`localization-${id}`} className="w-[240px]">
          <SelectValue>
            {localization === null
              ? defaultLabel
              : localizationName(localization)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>{defaultLabel}</SelectItem>
          {captured.map((tag) => (
            <SelectItem key={tag} value={tag}>
              {localizationName(tag)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
