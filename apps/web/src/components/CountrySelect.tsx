"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_OPTIONS, OTHER } from "@/lib/countries";
import { formatCountry } from "@/lib/format";

export function CountrySelect({
  id,
  value,
  onChange,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  ariaLabel?: string;
}) {
  const other = value === "" || !COUNTRY_OPTIONS.includes(value);

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
        />
      ) : null}
    </div>
  );
}
