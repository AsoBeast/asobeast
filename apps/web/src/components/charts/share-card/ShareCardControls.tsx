"use client";

import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  CARD_SIZE_NAMES,
  CARD_SIZES,
  type CardSizeName,
} from "@/lib/chart-image/share-card/card-layout";
import type {
  CardSwitch,
  ShareCardOptions,
} from "@/lib/chart-image/share-card/card-options";
import {
  CARD_THEME_NAMES,
  CARD_THEMES,
  type CardThemeName,
} from "@/lib/chart-image/share-card/card-themes";
import { cn } from "@/lib/utils";
import { ThemeSwatch } from "./ThemeSwatch";

const SWITCHES: { name: CardSwitch; label: string }[] = [
  { name: "change", label: "Show the change" },
  { name: "app", label: "Show the app" },
];

const SIZE_GLYPHS: Record<CardSizeName, string> = {
  landscape: "h-3.5 w-6",
  square: "size-4.5",
  portrait: "h-5 w-4",
};

const OPTION =
  "relative flex items-center rounded-lg has-focus-visible:ring-2 has-focus-visible:ring-ring";

function Choices({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-label font-medium text-muted-foreground">
        <span>{label}</span>
        {hint ? (
          <span className="font-normal tabular-nums">{` · ${hint}`}</span>
        ) : null}
      </span>
      <div role="radiogroup" aria-labelledby={id} className={className}>
        {children}
      </div>
    </div>
  );
}

function Choice({
  name,
  checked,
  onSelect,
  className,
  children,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <label className={cn(OPTION, className)}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="absolute inset-0 m-0 appearance-none rounded-lg outline-none"
      />
      {children}
    </label>
  );
}

function SizeChoices({
  value,
  onChange,
}: {
  value: CardSizeName;
  onChange: (size: CardSizeName) => void;
}) {
  const name = useId();
  const { width, height } = CARD_SIZES[value];
  return (
    <Choices
      label="Size"
      hint={`${width} × ${height} px`}
      className="grid grid-cols-3 gap-2"
    >
      {CARD_SIZE_NAMES.map((size) => (
        <Choice
          key={size}
          name={name}
          checked={size === value}
          onSelect={() => onChange(size)}
          className="flex-col items-start gap-1 border border-border p-2 hover:bg-muted has-checked:border-brand-mark has-checked:bg-brand-subtle has-checked:ring-1 has-checked:ring-brand-mark sm:flex-row sm:items-center sm:gap-3"
        >
          <span className="flex size-6 shrink-0 items-center justify-center">
            <span
              aria-hidden="true"
              className={cn(
                "rounded-xs border-2 border-muted-foreground",
                SIZE_GLYPHS[size],
              )}
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-dense font-medium">
              {CARD_SIZES[size].name}
            </span>
            <span className="text-caption text-muted-foreground">
              {CARD_SIZES[size].label}
            </span>
          </span>
        </Choice>
      ))}
    </Choices>
  );
}

function ThemeChoices({
  value,
  onChange,
}: {
  value: CardThemeName;
  onChange: (theme: CardThemeName) => void;
}) {
  const name = useId();
  return (
    <Choices label="Theme" className="grid grid-cols-4 gap-2 sm:flex sm:gap-3">
      {CARD_THEME_NAMES.map((theme) => (
        <Choice
          key={theme}
          name={name}
          checked={theme === value}
          onSelect={() => onChange(theme)}
          className="group flex-col gap-1 p-1"
        >
          <ThemeSwatch theme={CARD_THEMES[theme]} />
          <span className="text-caption text-muted-foreground group-has-checked:font-medium group-has-checked:text-foreground">
            {CARD_THEMES[theme].label}
          </span>
        </Choice>
      ))}
    </Choices>
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
      <SizeChoices
        value={options.size}
        onChange={(size) => onChange({ ...options, size })}
      />
      <ThemeChoices
        value={options.theme}
        onChange={(theme) => onChange({ ...options, theme })}
      />
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
