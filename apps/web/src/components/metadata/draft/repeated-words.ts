import { countChars, tokenize, type LintIssue } from "@asobeast/shared";
import { formatList } from "@/lib/format";

const REPEAT_RULES: ReadonlyMap<string, string> = new Map([
  ["repeats-title-word", "title"],
  ["repeats-subtitle-word", "subtitle"],
]);
const LISTED_WORDS = 6;

const repeatedWord = (issue: LintIssue): string | null =>
  REPEAT_RULES.has(issue.rule) && issue.offendingText
    ? issue.offendingText
    : null;

function wordsSentence(words: readonly string[], field: string): string {
  const quoted = words.map((word) => `"${word}"`);
  const listed =
    quoted.length > LISTED_WORDS
      ? `${quoted.slice(0, LISTED_WORDS).join(", ")} and ${quoted.length - LISTED_WORDS} more`
      : formatList(quoted);
  return `${listed} already appear in the ${field}.`;
}

export function groupLintIssues(issues: readonly LintIssue[]): LintIssue[] {
  const groups = new Map<string, LintIssue[]>();
  const order: (LintIssue | string)[] = [];
  for (const issue of issues) {
    if (repeatedWord(issue) === null) {
      order.push(issue);
      continue;
    }
    const key = `${issue.rule}:${issue.severity}`;
    const group = groups.get(key);
    if (group) group.push(issue);
    else {
      groups.set(key, [issue]);
      order.push(key);
    }
  }
  return order.map((entry) => {
    if (typeof entry !== "string") return entry;
    const group = groups.get(entry) ?? [];
    const [first] = group;
    if (group.length === 1) return first;
    return {
      rule: first.rule,
      severity: first.severity,
      message: wordsSentence(
        group.flatMap((issue) => repeatedWord(issue) ?? []),
        REPEAT_RULES.get(first.rule) ?? first.rule,
      ),
    };
  });
}

export const repeatedWords = (issues: readonly LintIssue[]): Set<string> =>
  new Set(issues.flatMap((issue) => repeatedWord(issue) ?? []));

export interface RepeatRemoval {
  value: string;
  words: number;
  chars: number;
}

const WORD_SEPARATOR = /[^\p{L}\p{M}\p{N}]+/u;

function withoutRepeats(
  part: string,
  repeated: ReadonlySet<string>,
): { kept: string | null; removed: number } {
  const segments = part.split(WORD_SEPARATOR).filter(Boolean);
  const kept = segments.filter((segment) =>
    tokenize(segment).some((token) => !repeated.has(token)),
  );
  const removed = segments.length - kept.length;
  if (removed === 0) return { kept: part, removed };
  return { kept: kept.length === 0 ? null : kept.join(" "), removed };
}

export function removeRepeats(
  keywordField: string,
  repeated: ReadonlySet<string>,
): RepeatRemoval {
  let words = 0;
  const terms = keywordField.split(",").flatMap((term) => {
    const parts = term.trim().split(/\s+/).filter(Boolean);
    const results = parts.map((part) => withoutRepeats(part, repeated));
    const removed = results.reduce((sum, result) => sum + result.removed, 0);
    if (removed === 0) return [term];
    words += removed;
    const kept = results.flatMap((result) => result.kept ?? []);
    return kept.length === 0 ? [] : [kept.join(" ")];
  });
  const value = terms.join(",");
  return {
    value,
    words,
    chars: countChars(keywordField) - countChars(value),
  };
}
