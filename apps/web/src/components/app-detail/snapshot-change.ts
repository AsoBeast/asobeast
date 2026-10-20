import { isChangeField, type SnapshotChange } from "@asobeast/shared";
import { CHANGE_FIELD_LABELS } from "@/lib/change-fields";
import { formatNumber, formatPrice, formatRating } from "@/lib/format";
import { localizedLabel } from "@/lib/localizations";
import { releaseNotesInline } from "@/components/changes/release-notes";

type ChangeValue = SnapshotChange["before"];

const SNAPSHOT_ONLY_LABELS: Readonly<Record<string, string>> = {
  ratingAvg: "Rating",
  ratingCount: "Ratings",
  installs: "Installs",
};

const EMPTY = "—";

const TEXT_LENGTH_FIELDS: ReadonlySet<string> = new Set([
  "title",
  "subtitle",
  "summary",
  "description",
]);

function fieldLabel(field: string): string {
  if (isChangeField(field)) return CHANGE_FIELD_LABELS[field];
  return Object.hasOwn(SNAPSHOT_ONLY_LABELS, field)
    ? SNAPSHOT_ONLY_LABELS[field]
    : field;
}

export function snapshotChangeLabel({
  field,
  localization,
}: Pick<SnapshotChange, "field" | "localization">): string {
  return localizedLabel(fieldLabel(field), localization);
}

function cell(value: ChangeValue): string {
  return value === null || value === "" ? EMPTY : String(value);
}

function length(value: ChangeValue): string {
  return typeof value === "number"
    ? `${formatNumber(value)} chars`
    : cell(value);
}

function notes(value: ChangeValue): string {
  return cell(typeof value === "string" ? releaseNotesInline(value) : value);
}

type NumberFormatter = (value: number, currency?: string | null) => string;

const NUMBER_FORMATTERS: Readonly<Record<string, NumberFormatter>> = {
  ratingAvg: formatRating,
  ratingCount: formatNumber,
  installs: formatNumber,
  price: formatPrice,
  screenshots: formatNumber,
};

function formatted(
  value: ChangeValue,
  format: NumberFormatter,
  currency: string | null | undefined,
) {
  const number = Number(value);
  return value === null || value === "" || !Number.isFinite(number)
    ? cell(value)
    : format(number, currency);
}

function numberCells(
  field: string,
  before: ChangeValue,
  after: ChangeValue,
  currency: string | null | undefined,
) {
  const format = NUMBER_FORMATTERS[field];
  return {
    before: formatted(before, format, currency),
    after: formatted(after, format, currency),
  };
}

export function snapshotChangeCells(
  { field, before, after }: SnapshotChange,
  currency?: string | null,
): {
  before: string;
  after: string;
} {
  if (field === "icon") return { before: EMPTY, after: "Icon updated" };
  if (field === "whatsNew")
    return { before: notes(before), after: notes(after) };
  if (TEXT_LENGTH_FIELDS.has(field)) {
    return { before: length(before), after: length(after) };
  }
  if (Object.hasOwn(NUMBER_FORMATTERS, field)) {
    return numberCells(field, before, after, currency);
  }
  return { before: cell(before), after: cell(after) };
}
