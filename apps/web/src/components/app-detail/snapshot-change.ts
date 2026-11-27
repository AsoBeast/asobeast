import {
  isChangeField,
  isStoreField,
  type SnapshotChange,
} from "@asobeast/shared";
import { releaseNotesInline } from "@/components/changes/release-notes";
import type { TranslationContext } from "@/i18n/translator";
import {
  formatNumberInLocale,
  formatPrice,
  formatRatingInLocale,
} from "@/lib/format";
import { localizedLabel } from "@/lib/localizations";

type ChangeValue = SnapshotChange["before"];

const FIELD_KEYS: Readonly<Record<string, string>> = {
  title: "title",
  subtitle: "subtitle",
  summary: "summary",
  description: "description",
  version: "version",
  price: "price",
  screenshots: "screenshots",
  screenshotImages: "screenshotImages",
  screenshotCaptions: "screenshotCaptions",
  icon: "icon",
  whatsNew: "whatsNew",
  inAppEvents: "inAppEvents",
  featuring: "featuring",
  editorsChoice: "editorsChoice",
  ratingAvg: "ratingAvg",
  ratingCount: "ratingCount",
  installs: "installs",
};

const EMPTY = "—";

const TEXT_LENGTH_FIELDS: ReadonlySet<string> = new Set([
  "title",
  "subtitle",
  "summary",
  "description",
]);

function fieldLabel(field: string, context: TranslationContext): string {
  const key = Object.hasOwn(FIELD_KEYS, field) ? FIELD_KEYS[field] : undefined;
  return key === undefined
    ? field
    : context.translator(`snapshot.fields.${key}`);
}

export function snapshotChangeLabel(
  { field, localization }: Pick<SnapshotChange, "field" | "localization">,
  context: TranslationContext,
): string {
  return localizedLabel(
    fieldLabel(field, context),
    localization,
    context.locale,
  );
}

function cell(value: ChangeValue): string {
  return value === null || value === "" ? EMPTY : String(value);
}

function length(value: ChangeValue, context: TranslationContext): string {
  return typeof value === "number"
    ? context.translator("snapshot.characters", {
        count: formatNumberInLocale(value, context.locale),
      })
    : cell(value);
}

function notes(value: ChangeValue): string {
  return cell(typeof value === "string" ? releaseNotesInline(value) : value);
}

type NumberFormatter = (
  value: number,
  context: TranslationContext,
  currency?: string | null,
) => string;

const NUMBER_FORMATTERS: Readonly<Record<string, NumberFormatter>> = {
  ratingAvg: (value, context) => formatRatingInLocale(value, context.locale),
  ratingCount: (value, context) => formatNumberInLocale(value, context.locale),
  installs: (value, context) => formatNumberInLocale(value, context.locale),
  price: (value, context, currency) =>
    formatPrice(value, currency, context.translator("snapshot.free")),
  screenshots: (value, context) => formatNumberInLocale(value, context.locale),
};

function formatted(
  value: ChangeValue,
  format: NumberFormatter,
  context: TranslationContext,
  currency: string | null | undefined,
): string {
  const number = Number(value);
  return value === null || value === "" || !Number.isFinite(number)
    ? cell(value)
    : format(number, context, currency);
}

function numberCells(
  field: string,
  before: ChangeValue,
  after: ChangeValue,
  formatting: {
    currency: string | null | undefined;
    context: TranslationContext;
  },
): { before: string; after: string } {
  const { currency, context } = formatting;
  const format = NUMBER_FORMATTERS[field];
  return {
    before: formatted(before, format, context, currency),
    after: formatted(after, format, context, currency),
  };
}

type Detail = NonNullable<SnapshotChange["detail"]>;

function summaryLine<T>(
  items: readonly T[],
  keys: { one: string; many: string },
  nameOf: (item: T) => string,
  context: TranslationContext,
): string | null {
  const [one] = items;
  if (one && items.length === 1) {
    return context.translator(keys.one, { name: nameOf(one) });
  }
  return items.length > 1
    ? context.translator(keys.many, { count: items.length })
    : null;
}

function eventName(
  ref: Extract<Detail, { kind: "events" }>["added"][number],
  context: TranslationContext,
): string {
  return (
    ref.title ??
    ref.kind ??
    context.translator("snapshot.storeSummary.eventFallback")
  );
}

function storyName(
  ref: Extract<Detail, { kind: "featuring" }>["added"][number],
  context: TranslationContext,
): string {
  return (
    ref.title ??
    ref.heading ??
    context.translator("snapshot.storeSummary.storyFallback")
  );
}

function joined(lines: Array<string | null>): string {
  return lines.filter((line): line is string => line !== null).join(", ");
}

function storeSummary(detail: Detail, context: TranslationContext): string {
  if (detail.kind === "events") {
    return joined([
      summaryLine(
        detail.added,
        {
          one: "snapshot.storeSummary.eventAddedOne",
          many: "snapshot.storeSummary.eventAddedMany",
        },
        (ref) => eventName(ref, context),
        context,
      ),
      summaryLine(
        detail.removed,
        {
          one: "snapshot.storeSummary.eventRemovedOne",
          many: "snapshot.storeSummary.eventRemovedMany",
        },
        (ref) => eventName(ref, context),
        context,
      ),
    ]);
  }
  if (detail.kind === "featuring") {
    return joined([
      summaryLine(
        detail.added,
        {
          one: "snapshot.storeSummary.storyAddedOne",
          many: "snapshot.storeSummary.storyAddedMany",
        },
        (ref) => storyName(ref, context),
        context,
      ),
      summaryLine(
        detail.removed,
        {
          one: "snapshot.storeSummary.storyRemovedOne",
          many: "snapshot.storeSummary.storyRemovedMany",
        },
        (ref) => storyName(ref, context),
        context,
      ),
    ]);
  }
  if (detail.kind !== "editorsChoice") return "";
  return context.translator(
    detail.showsBadge
      ? "snapshot.storeSummary.editorsChoiceAdded"
      : "snapshot.storeSummary.editorsChoiceRemoved",
  );
}

export function snapshotChangeCells(
  { field, before, after, detail }: SnapshotChange,
  currency: string | null | undefined,
  context: TranslationContext,
): { before: string; after: string } {
  if (field === "icon") {
    return {
      before: EMPTY,
      after: context.translator("snapshot.iconUpdated"),
    };
  }
  if (field === "whatsNew") {
    return { before: notes(before), after: notes(after) };
  }
  if (isChangeField(field) && isStoreField(field)) {
    const summary = detail ? storeSummary(detail, context) : "";
    return { before: EMPTY, after: summary === "" ? EMPTY : summary };
  }
  if (TEXT_LENGTH_FIELDS.has(field)) {
    return {
      before: length(before, context),
      after: length(after, context),
    };
  }
  if (Object.hasOwn(NUMBER_FORMATTERS, field)) {
    return numberCells(field, before, after, { currency, context });
  }
  return { before: cell(before), after: cell(after) };
}
