const LIST_MARKER = /^(?:[•·]|[-–—*](?=\s|$))\s*/;

export function releaseNotesInline(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(LIST_MARKER, ""))
    .filter((line) => line !== "")
    .join(" · ");
}
