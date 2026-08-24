"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleCheck, CircleHelp } from "lucide-react";
import type { MarketAvailability } from "@asobeast/shared";
import { COUNTRY_CODE } from "@/lib/countries";
import { formatCountry } from "@/lib/format";
import { marketAvailabilityOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<
  MarketAvailability,
  { icon: typeof CircleCheck; className: string }
> = {
  available: {
    icon: CircleCheck,
    className: "text-success",
  },
  unavailable: {
    icon: AlertTriangle,
    className: "text-warning",
  },
  unknown: { icon: CircleHelp, className: "text-muted-foreground" },
};

function statusLabel(status: MarketAvailability, country: string): string {
  const market = formatCountry(country);
  if (status === "available") {
    return `Published in ${market}`;
  }
  if (status === "unavailable") {
    return `Not published in ${market} — you can still track keywords there`;
  }
  return `Could not verify availability in ${market}`;
}

export function MarketAvailabilityNotice({
  appId,
  country,
}: {
  appId: string;
  country: string;
}) {
  const valid = COUNTRY_CODE.test(country);
  const { data, isError } = useQuery({
    ...marketAvailabilityOptions(appId, country),
    enabled: valid,
  });

  const status: MarketAvailability | undefined = valid
    ? (data?.status ?? (isError ? "unknown" : undefined))
    : undefined;
  const style = status ? STATUS_STYLE[status] : null;
  const Icon = style?.icon;

  return (
    <p
      aria-live="polite"
      className={cn(
        "flex min-h-5 items-center gap-1.5 text-xs",
        style?.className ?? "text-muted-foreground",
      )}
    >
      {status && Icon ? (
        <>
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {statusLabel(status, country)}
        </>
      ) : null}
    </p>
  );
}
