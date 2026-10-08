import { isChangeField, type SnapshotChange } from "@asobeast/shared";
import { CHANGE_FIELD_LABELS } from "@/lib/change-fields";
import { releaseNotesInline } from "@/components/changes/release-notes";

type ChangeValue = SnapshotChange["before"];

const SNAPSHOT_ONLY_LABELS: Readonly<Record<string, string>> = {
  ratingAvg: "Rating",
  ratingCount: "Ratings",
  installs: "Installs",
};

const EMPTY = "—";

export function snapshotChangeLabel(field: string): string {
  if (isChangeField(field)) return CHANGE_FIELD_LABELS[field];
  return Object.hasOwn(SNAPSHOT_ONLY_LABELS, field)
    ? SNAPSHOT_ONLY_LABELS[field]
    : field;
}

function cell(value: ChangeValue): string {
  return value === null || value === "" ? EMPTY : String(value);
}

function notes(value: ChangeValue): string {
  return cell(typeof value === "string" ? releaseNotesInline(value) : value);
}

export function snapshotChangeCells({ field, before, after }: SnapshotChange): {
  before: string;
  after: string;
} {
  if (field === "icon") return { before: EMPTY, after: "Icon updated" };
  if (field === "whatsNew")
    return { before: notes(before), after: notes(after) };
  return { before: cell(before), after: cell(after) };
}
