import type { ChangeEventItem } from "@asobeast/shared";

export function hasScreenshotDetail(event: ChangeEventItem): boolean {
  return (
    event.detail !== undefined &&
    event.detail !== null &&
    event.field.startsWith("screenshot")
  );
}

const positions = (list: number[]): string =>
  list.length === 1
    ? `${list[0]}`
    : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;

const screenshotWord = (list: number[]): string =>
  list.length === 1 ? "Screenshot" : "Screenshots";

const quoted = (text: string): string => `“${text}”`;

const capitalised = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

export function screenshotChangeSummary(event: ChangeEventItem): string {
  const detail = event.detail;
  if (detail?.kind === "captions") {
    const from = detail.removed.map(quoted).join(", ");
    const to = detail.added.map(quoted).join(", ");
    if (from && to) return `Caption changed: ${from} to ${to}`;
    return from ? `Caption removed: ${from}` : `Caption added: ${to}`;
  }
  if (detail?.kind !== "images") return "";

  const replaced = Math.min(detail.added.length, detail.removed.length);
  const groups: [number[], string][] = [
    [detail.added.slice(0, replaced), "replaced"],
    [detail.added.slice(replaced), "added"],
    [detail.removed.slice(replaced), "removed"],
  ];
  const parts = groups
    .filter(([list]) => list.length > 0)
    .map(
      ([list, verb]) => `${screenshotWord(list)} ${positions(list)} ${verb}`,
    );
  if (detail.reordered) parts.push("screenshots reordered");
  return capitalised(parts.join(", "));
}
