import type { RankDistribution } from "@asobeast/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bandSegments, bandSummary } from "./rank-bands";

export function RankBandBar({
  distribution,
}: {
  distribution: RankDistribution;
}) {
  const segments = bandSegments(distribution);
  if (segments.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="img"
          aria-label={bandSummary(distribution)}
          tabIndex={0}
          data-slot="rank-band-bar"
          className="relative z-20 flex h-6 w-full items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full">
            {segments.map((segment) => (
              <span
                key={segment.key}
                className={cn("h-full", segment.fill)}
                style={{ flexGrow: segment.share }}
              />
            ))}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1">
          {segments.map((segment) => (
            <div key={segment.key} className="contents">
              <dt>{segment.label}</dt>
              <dd className="numeric text-right font-mono">
                {formatNumber(segment.count)}
              </dd>
            </div>
          ))}
        </dl>
      </TooltipContent>
    </Tooltip>
  );
}
