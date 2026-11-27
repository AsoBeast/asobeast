"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import {
  KEYWORD_ZONES,
  zoneLabel,
  zoneMeaning,
  zoneRule,
  type KeywordZone,
  type ZoneCounts,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import type { MessageTranslator } from "@/i18n/translator";
import { ZONE_FILLS } from "./zone-layers";

const OPPORTUNITY_MAP_GUIDE =
  "https://docs.asobeast.com/guides/track-keywords#read-the-opportunity-map";

const SWATCH_OPACITY = 0.5;

const toggleName = (
  name: string,
  count: number,
  t: MessageTranslator,
): string => t("map.zones.toggle", { name, count });

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
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  return (
    <ul
      aria-label={t("map.zones.aria")}
      className="grid grid-cols-2 gap-2 lg:grid-cols-4"
    >
      {KEYWORD_ZONES.map((zone) => {
        const name = zoneLabel(zone, keywords);
        const count = counts.zones[zone];
        return (
          <li key={zone} className="flex min-w-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={selected === zone}
              aria-label={toggleName(name, count, t)}
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
              label={t("map.zones.about", { name })}
              title={name}
              summary={t("map.zones.summary", {
                meaning: zoneMeaning(zone, keywords),
                rule: zoneRule(zone, thresholds, keywords),
              })}
            >
              <a
                href={OPPORTUNITY_MAP_GUIDE}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground link-underline"
              >
                {t("map.zones.guide")}
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
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  return (
    <div className="sr-only">
      <table>
        <caption>{t("map.zones.tableCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("map.zones.zone")}</th>
            <th scope="col">{t("map.zones.rule")}</th>
            <th scope="col">{t("map.zones.keywords")}</th>
          </tr>
        </thead>
        <tbody>
          {KEYWORD_ZONES.map((zone) => (
            <tr key={zone}>
              <th scope="row">{zoneLabel(zone, keywords)}</th>
              <td>{zoneRule(zone, thresholds, keywords)}</td>
              <td>{String(counts.zones[zone])}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">{t("map.zones.unplotted")}</th>
            <td>{t("map.zones.missing")}</td>
            <td>{String(counts.unplotted)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
