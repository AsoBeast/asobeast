export type Measure = (text: string) => number;

const ELLIPSIS = "…";

export function clipText(
  text: string,
  maxWidth: number,
  measure: Measure,
): string {
  if (measure(text) <= maxWidth) return text;
  const characters = Array.from(text);
  while (
    characters.length > 0 &&
    measure(`${characters.join("")}${ELLIPSIS}`) > maxWidth
  ) {
    characters.pop();
  }
  return `${characters.join("")}${ELLIPSIS}`;
}

export function wrapWords(
  text: string,
  maxWidth: number,
  measure: Measure,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (line !== "" && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  return line === "" ? lines : [...lines, line];
}
