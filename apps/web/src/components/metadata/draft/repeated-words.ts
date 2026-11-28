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

export function removeRepeats(
  keywordField: string,
  repeated: ReadonlySet<string>,
): RepeatRemoval {
  let words = 0;
  const isRepeat = (word: string) => {
    const tokens = tokenize(word);
    return tokens.length > 0 && tokens.every((token) => repeated.has(token));
  };
  const terms = keywordField.split(",").flatMap((term) => {
    const parts = term.trim().split(/\s+/).filter(Boolean);
    const kept = parts.filter((part) => !isRepeat(part));
    if (kept.length === parts.length) return [term];
    words += parts.length - kept.length;
    return kept.length === 0 ? [] : [kept.join(" ")];
  });
  const value = terms.join(",");
  return {
    value,
    words,
    chars: countChars(keywordField) - countChars(value),
  };
}
