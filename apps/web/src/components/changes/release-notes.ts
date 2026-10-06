const LINE_BREAK = /\r\n?|\n/;
const LIST_MARKER = /^(?:[•·]|[-–—*](?=\s|$))\s*/;

export function releaseNotesInline(value: string): string {
  return value
    .split(LINE_BREAK)
    .map((line) => line.trim().replace(LIST_MARKER, ""))
    .filter((line) => line !== "")
    .join(" · ");
}
