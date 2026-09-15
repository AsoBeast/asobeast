"use client";

import { useId } from "react";
import type { Store } from "@asobeast/shared";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_OPTIONS, OTHER, marketError } from "@/lib/countries";
import { formatCountry } from "@/lib/format";

export function CountrySelect({
  id,
  store,
  value,
  onChange,
  ariaLabel,
}: {
  id?: string;
  store: Store;
  value: string;
  onChange: (code: string) => void;
  ariaLabel?: string;
}) {
  const errorId = useId();
  const other = value === "" || !COUNTRY_OPTIONS.includes(value);
  const error = other && value.length === 2 ? marketError(store, value) : null;

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={other ? OTHER : value}
        onValueChange={(next) => onChange(next === OTHER ? "" : next)}
      >
        <SelectTrigger id={id} aria-label={ariaLabel} className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_OPTIONS.map((code) => (
            <SelectItem key={code} value={code}>
              {code.toUpperCase()} · {formatCountry(code)}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {other ? (
        <Input
          aria-label="Storefront country code"
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          placeholder="two letter code, e.g. se"
          maxLength={2}
          className="w-[220px]"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
        />
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
