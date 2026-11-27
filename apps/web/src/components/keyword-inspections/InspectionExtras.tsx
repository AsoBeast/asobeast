import type { ReactNode } from "react";
import type {
  KeywordInspection,
  KeywordInspectionDelta,
  KeywordInspectionSummary,
} from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { formatDateTimeInLocale, formatListInLocale } from "@/lib/format";
import { zoneLabel, zoneMeaning, zoneOf } from "@/lib/keyword-zones";
import { useAppLocale } from "@/lib/use-app-locale";
import type { MessageTranslator } from "@/i18n/translator";
import {
  autocompleteLine,
  changeTone,
  scoreChange,
  signedChange,
  storefrontCode,
} from "./inspection-format";

const NOTE = "text-caption text-faint-foreground";
const NOTE_FIGURE = "font-medium text-muted-foreground";
const ELSEWHERE_LINK =
  "rounded-sm text-foreground link-underline outline-none focus-visible:ring-2 focus-visible:ring-ring";

function spokenChange(
  label: string,
  change: number | null,
  higherIsBetter: boolean,
  t: MessageTranslator,
): string | null {
  if (change === null) return null;
  const tone = changeTone(change, higherIsBetter);
  return t("inspector.notes.change", {
    label,
    change: signedChange(change, t),
    tone: tone === "same" ? "same" : t(`inspector.notes.tones.${tone}`),
  });
}

function InspectionVerdict({ inspection }: { inspection: KeywordInspection }) {
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  const { thresholds } = useZoneThresholds();
  if (inspection.volume === null || inspection.difficulty100 === null) {
    return null;
  }
  const zone = zoneOf(
    {
      popularity: Math.round(inspection.volume),
      difficulty: Math.round(inspection.difficulty100),
    },
    thresholds,
  );
  if (zone === null) return null;
  return (
    <p className="text-body text-muted-foreground">
      {t.rich("inspector.notes.verdict", {
        zone: zoneLabel(zone, keywords),
        meaning: zoneMeaning(zone, keywords),
        label: (chunks) => (
          <span className="font-medium text-foreground">{chunks}</span>
        ),
      })}
    </p>
  );
}

function InspectionDelta({
  inspection,
  previous,
}: {
  inspection: KeywordInspection;
  previous: KeywordInspectionDelta;
}) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const enteredTitles = previous.entered.length
    ? formatListInLocale(
        previous.entered.map((app) => app.title),
        locale,
      )
    : "none";
  const leftTitles = previous.left.length
    ? formatListInLocale(
        previous.left.map((app) => app.title),
        locale,
      )
    : "none";
  return (
    <section aria-labelledby="inspection-delta" className={NOTE}>
      <h3 id="inspection-delta" className="sr-only">
        {t("inspector.notes.sincePrevious")}
      </h3>
      <p>
        {t.rich("inspector.notes.delta", {
          date: formatDateTimeInLocale(previous.completedAt, locale),
          enteredTitles,
          leftTitles,
          entered: (chunks) => <span className={NOTE_FIGURE}>{chunks}</span>,
          left: (chunks) => <span className={NOTE_FIGURE}>{chunks}</span>,
        })}
      </p>
      <p className="sr-only">
        {[
          spokenChange(
            t("inspector.log.popularity"),
            scoreChange(inspection.volume, previous.volume),
            true,
            t,
          ),
          spokenChange(
            t("inspector.log.difficulty"),
            scoreChange(inspection.difficulty100, previous.difficulty100),
            false,
            t,
          ),
        ]
          .filter((line) => line !== null)
          .join(t("inspector.notes.listSeparator"))}
      </p>
    </section>
  );
}

function elsewhereLinks(
  items: readonly KeywordInspectionSummary[],
  locale: ReturnType<typeof useAppLocale>,
  onSelect: (id: string) => void,
): ReactNode {
  const codes = items.map((item) => storefrontCode(item.store, item.country));
  let itemIndex = 0;
  return new Intl.ListFormat(locale, { type: "conjunction" })
    .formatToParts(codes)
    .map((part, index) => {
      if (part.type !== "element") {
        return <span key={`separator-${index}`}>{part.value}</span>;
      }
      const item = items[itemIndex];
      itemIndex += 1;
      return (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={ELSEWHERE_LINK}
        >
          {part.value}
        </button>
      );
    });
}

function SearchNotes({
  inspection,
  elsewhere,
  onSelect,
}: {
  inspection: KeywordInspection;
  elsewhere: readonly KeywordInspectionSummary[];
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("keywordInspector");
  const locale = useAppLocale();
  const autocomplete = autocompleteLine(inspection.signals, t);
  if (autocomplete === null && elsewhere.length === 0) return null;
  const items = elsewhere.length
    ? formatListInLocale(
        elsewhere.map((item) => storefrontCode(item.store, item.country)),
        locale,
      )
    : "";
  const links = elsewhereLinks(elsewhere, locale, onSelect);
  return (
    <p className={NOTE}>
      {t.rich("inspector.notes.search", {
        autocomplete: autocomplete ?? "none",
        elsewhere: elsewhere.length > 0 ? "present" : "none",
        items,
        autocompleteText: (chunks) => <span>{chunks}</span>,
        elsewhereText: () =>
          elsewhere.length === 0
            ? null
            : t.rich("inspector.notes.elsewhere", {
                items,
                links: () => links,
              }),
      })}
    </p>
  );
}

export function InspectionNotes({
  inspection,
  elsewhere,
  onSelect,
}: {
  inspection: KeywordInspection;
  elsewhere: readonly KeywordInspectionSummary[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <InspectionVerdict inspection={inspection} />
      {inspection.previous ? (
        <InspectionDelta
          inspection={inspection}
          previous={inspection.previous}
        />
      ) : null}
      <SearchNotes
        inspection={inspection}
        elsewhere={elsewhere}
        onSelect={onSelect}
      />
    </div>
  );
}
