"use client";

import { useState, type FormEvent } from "react";
import { Check, ExternalLink, Plus, X } from "lucide-react";
import Link from "next/link";
import { formatCountry } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function StepHeader({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <CardHeader>
      <CardDescription>Step {number} of 5</CardDescription>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
  );
}

export function SetupCheckbox({
  id,
  checked,
  disabled,
  label,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <Label htmlFor={id} className="leading-4">
        {label}
      </Label>
    </div>
  );
}

export function MarketsStep({
  appId,
  homeMarket,
  markets,
  onSelect,
}: {
  appId: string;
  homeMarket: string;
  markets: string[];
  onSelect: (market: string, selected: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const market = value.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(market)) {
      setError("Enter a two-letter country code.");
      return;
    }
    onSelect(market, true);
    setValue("");
    setError(null);
  };

  return (
    <Card>
      <StepHeader
        number={1}
        title="Choose markets"
        description="Your home storefront is selected. Add any other storefronts where you want to track keywords."
      />
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {markets.map((market) => (
            <Badge
              key={market}
              variant="secondary"
              className="h-7 gap-1 pl-2.5"
            >
              {formatCountry(market)} ({market.toUpperCase()})
              {market !== homeMarket && markets.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove ${formatCountry(market)}`}
                  onClick={() => onSelect(market, false)}
                  className="rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
        <form onSubmit={submit} className="flex max-w-sm items-start gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor="setup-market">Add a country code</Label>
            <Input
              id="setup-market"
              value={value}
              maxLength={2}
              placeholder="gb"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "setup-market-error" : undefined}
              onChange={(event) => setValue(event.target.value)}
            />
            {error ? (
              <span
                id="setup-market-error"
                className="text-xs text-destructive"
              >
                {error}
              </span>
            ) : null}
          </div>
          <Button type="submit" variant="outline" className="mt-4">
            <Plus />
            Add
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {markets.map((market) => (
            <Button key={market} asChild variant="outline" size="sm">
              <Link href={`/apps/${appId}/keywords?country=${market}`}>
                Review {market.toUpperCase()} keywords
                <ExternalLink />
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CompetitorsStep({
  appId,
  count,
  error,
  acknowledged,
  onAcknowledge,
}: {
  appId: string;
  count: number | null;
  error: boolean;
  acknowledged: boolean;
  onAcknowledge: (checked: boolean) => void;
}) {
  return (
    <Card>
      <StepHeader
        number={2}
        title="Add competitors"
        description="Track the apps you compete with so one search can compare every ranking."
      />
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {error
            ? "Competitor count is temporarily unavailable."
            : count === null
              ? "Loading competitors…"
              : `${count} competitor${count === 1 ? "" : "s"} configured`}
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/apps/${appId}/competitors`}>
            Manage competitors
            <ExternalLink />
          </Link>
        </Button>
        {count === 0 ? (
          <SetupCheckbox
            id="setup-no-competitors"
            checked={acknowledged}
            onChange={onAcknowledge}
            label="No competitors yet — continue setup without one"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export interface MarketKeywordCount {
  market: string;
  active: number | null;
  error: boolean;
}

export function KeywordsStep({
  appId,
  homeMarket,
  counts,
  confirmed,
  onConfirm,
}: {
  appId: string;
  homeMarket: string;
  counts: MarketKeywordCount[];
  confirmed: boolean;
  onConfirm: (checked: boolean) => void;
}) {
  return (
    <Card>
      <StepHeader
        number={3}
        title="Confirm keywords"
        description="Review the active phrases in each selected market before the daily checks begin."
      />
      <CardContent className="flex flex-col gap-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {counts.map(({ market, active, error }) => (
            <li
              key={market}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <span>{formatCountry(market)}</span>
              <span className="text-muted-foreground">
                {error
                  ? "Unavailable"
                  : active === null
                    ? "Loading…"
                    : `${active} active`}
              </span>
            </li>
          ))}
        </ul>
        <Button asChild variant="outline" className="w-fit">
          <Link
            href={`/apps/${appId}/keywords?country=${counts[0]?.market ?? homeMarket}`}
          >
            Review keywords
            <ExternalLink />
          </Link>
        </Button>
        <SetupCheckbox
          id="setup-keywords-confirmed"
          checked={confirmed}
          disabled={counts.some(
            (count) => count.active === null || count.error,
          )}
          onChange={onConfirm}
          label="I reviewed the keywords for these markets"
        />
      </CardContent>
    </Card>
  );
}

export function AlertsStep({
  count,
  error,
  skipped,
  onSkip,
}: {
  count: number | null;
  error: boolean;
  skipped: boolean;
  onSkip: (checked: boolean) => void;
}) {
  return (
    <Card>
      <StepHeader
        number={5}
        title="Configure alerts"
        description="Alert channels are optional. Add a webhook or email, or explicitly skip this step."
      />
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {error
            ? "Alert count is temporarily unavailable."
            : count === null
              ? "Loading alert channels…"
              : `${count} alert channel${count === 1 ? "" : "s"} configured`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/settings#webhooks">Configure webhooks</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings#email-alerts">Configure email alerts</Link>
          </Button>
        </div>
        {count === 0 ? (
          <SetupCheckbox
            id="setup-alerts-skipped"
            checked={skipped}
            onChange={onSkip}
            label="Skip alerts for now"
          />
        ) : count && count > 0 ? (
          <span className="inline-flex items-center gap-2 text-sm text-success">
            <Check className="size-4" /> Alert setup is ready
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
