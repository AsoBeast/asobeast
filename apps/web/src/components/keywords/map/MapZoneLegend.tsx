"use client";

import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import {
  KEYWORD_ZONES,
  ZONE_LABELS,
  zoneMeaning,
  zoneRule,
  type KeywordZone,
  type ZoneCounts,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import { ZONE_FILLS } from "./zone-layers";

const OPPORTUNITY_MAP_GUIDE =
  "https://docs.asobeast.com/guides/track-keywords#read-the-opportunity-map";

const SWATCH_OPACITY = 0.5;

const toggleName = (name: string, count: number): string =>
  `${name} ${count} ${count === 1 ? "keyword" : "keywords"}`;

export function MapZoneLegend({
  counts,
  thresholds,
  selected,
  onToggle,
}: {
  counts: ZoneCounts;
  thresholds: ZoneThresholds;
  selected: KeywordZone | null;
  onToggle: (zone: KeywordZone) => void;
}) {
  return (
    <ul aria-label="Zones" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {KEYWORD_ZONES.map((zone) => {
        const name = ZONE_LABELS[zone];
        const count = counts.zones[zone];
        return (
          <li key={zone} className="flex min-w-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={selected === zone}
              aria-label={toggleName(name, count)}
              onClick={() => onToggle(zone)}
              className="h-auto min-h-8 min-w-0 flex-1 justify-start py-1 text-left whitespace-normal aria-pressed:border-foreground aria-pressed:bg-secondary"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full border border-border"
                style={{
                  backgroundColor: ZONE_FILLS[zone],
                  opacity: SWATCH_OPACITY,
                }}
              />
              <span className="min-w-0">{name}</span>
              <span className="ml-auto numeric">{String(count)}</span>
            </Button>
            <InfoTip
              label={`About ${name}`}
              title={name}
              summary={`${zoneMeaning(zone)} ${zoneRule(zone, thresholds)}.`}
            >
              <a
                href={OPPORTUNITY_MAP_GUIDE}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-2"
              >
                Read the opportunity map
              </a>
            </InfoTip>
          </li>
        );
      })}
    </ul>
  );
}

export function MapZoneTable({
  counts,
  thresholds,
}: {
  counts: ZoneCounts;
  thresholds: ZoneThresholds;
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>Opportunity map zones</caption>
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">Rule</th>
            <th scope="col">Keywords</th>
          </tr>
        </thead>
        <tbody>
          {KEYWORD_ZONES.map((zone) => (
            <tr key={zone}>
              <th scope="row">{ZONE_LABELS[zone]}</th>
              <td>{zoneRule(zone, thresholds)}</td>
              <td>{String(counts.zones[zone])}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Not on the map</th>
            <td>Missing a popularity or a difficulty</td>
            <td>{String(counts.unplotted)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
