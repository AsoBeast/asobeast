export type VariableLookup = (name: string) => string | null;

const OPENER = "var(";
const MAX_DEPTH = 8;

function matchingParenthesis(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const character = text[index];
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function topLevelComma(text: string): number {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) return index;
  }
  return -1;
}

function resolveReference(
  reference: string,
  lookup: VariableLookup,
  depth: number,
): string | null {
  const comma = topLevelComma(reference);
  const name = (comma === -1 ? reference : reference.slice(0, comma)).trim();
  const fallback = comma === -1 ? null : reference.slice(comma + 1).trim();
  const value = lookup(name)?.trim();
  if (value) return substitute(value, lookup, depth + 1);
  return fallback === null ? null : substitute(fallback, lookup, depth + 1);
}

function substitute(
  text: string,
  lookup: VariableLookup,
  depth: number,
): string {
  if (depth > MAX_DEPTH) return text;
  let result = "";
  let cursor = 0;
  for (;;) {
    const start = text.indexOf(OPENER, cursor);
    if (start === -1) break;
    const end = matchingParenthesis(text, start + OPENER.length - 1);
    if (end === -1) break;
    const resolved = resolveReference(
      text.slice(start + OPENER.length, end),
      lookup,
      depth,
    );
    result +=
      text.slice(cursor, start) + (resolved ?? text.slice(start, end + 1));
    cursor = end + 1;
  }
  return result + text.slice(cursor);
}

export function resolveCssVariables(
  text: string,
  lookup: VariableLookup,
): string {
  return substitute(text, lookup, 0);
}
