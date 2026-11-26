"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  CARD_SIZE_NAMES,
  CARD_SIZES,
  isCardSizeName,
} from "@/lib/chart-image/share-card/card-layout";
import type {
  CardSwitch,
  ShareCardOptions,
} from "@/lib/chart-image/share-card/card-options";
import {
  CARD_THEME_NAMES,
  CARD_THEMES,
  isCardThemeName,
} from "@/lib/chart-image/share-card/card-themes";

const SWITCHES: { name: CardSwitch; label: string }[] = [
  { name: "change", label: "Show the change" },
  { name: "app", label: "Show the app" },
];

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-label font-medium text-muted-foreground">
        {label}
      </span>
      <Tabs value={value} onValueChange={onChange}>
        <TabsList aria-labelledby={id}>
          {options.map((option) => (
            <TabsOption key={option.value} value={option.value}>
              {option.label}
            </TabsOption>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

function PartSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-dense font-normal">
        {label}
      </Label>
    </div>
  );
}

export function ShareCardControls({
  options,
  onChange,
}: {
  options: ShareCardOptions;
  onChange: (next: ShareCardOptions) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Choice
          label="Size"
          value={options.size}
          options={CARD_SIZE_NAMES.map((name) => ({
            value: name,
            label: CARD_SIZES[name].label,
          }))}
          onChange={(size) => {
            if (isCardSizeName(size)) onChange({ ...options, size });
          }}
        />
        <Choice
          label="Theme"
          value={options.theme}
          options={CARD_THEME_NAMES.map((name) => ({
            value: name,
            label: CARD_THEMES[name].label,
          }))}
          onChange={(theme) => {
            if (isCardThemeName(theme)) onChange({ ...options, theme });
          }}
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {SWITCHES.map(({ name, label }) => (
          <PartSwitch
            key={name}
            label={label}
            checked={options[name]}
            onChange={(next) => onChange({ ...options, [name]: next })}
          />
        ))}
      </div>
    </div>
  );
}
