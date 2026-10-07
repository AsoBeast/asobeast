import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { THAI_CHARACTER } from '../common/text/scripts';
import { isExtractionStopword, isThaiPrefix } from './extraction-stopwords';

export interface ThaiSpan {
  text: string;
  index: number;
  known: boolean;
}

interface Dictionary {
  words: ReadonlySet<string>;
  longest: number;
}

interface Step {
  from: number;
  known: boolean;
  unknownChars: number;
  words: number;
}

export const STORE_WORDS: readonly string[] = [
  'แอป',
  'ช้อป',
  'คริปโต',
  'เดลิเวอรี่',
  'วิดีโอคอล',
  'สกินแคร์',
  'แจ้งเตือน',
];

const THAI_WORD = /^\p{Script=Thai}{2,}$/u;
const CLUSTER_CONTINUATION = /[ะ-ฺๅ-๎]/u;
const LEADING_VOWEL = /[เ-ไ]/u;
const REPEAT_MARK = 'ๆ';

function isStopwordPhrase(entry: string): boolean {
  for (let cut = 1; cut < entry.length; cut += 1) {
    const tail = entry.slice(cut);
    if (
      isExtractionStopword(entry.slice(0, cut)) &&
      (isExtractionStopword(tail) || isStopwordPhrase(tail))
    ) {
      return true;
    }
  }
  return false;
}

function loadDictionary(): Dictionary {
  const words = new Set(
    [
      ...readFileSync(join(__dirname, 'thai-words.txt'), 'utf8').split('\n'),
      ...STORE_WORDS,
    ]
      .map((line) => line.trim())
      .filter((entry) => THAI_WORD.test(entry) && !isStopwordPhrase(entry)),
  );
  const longest = [...words].reduce(
    (max, word) => Math.max(max, word.length),
    0,
  );
  return { words, longest };
}

const dictionary = loadDictionary();

const isWordEdge = (run: string, index: number): boolean =>
  index === 0 ||
  index === run.length ||
  (!CLUSTER_CONTINUATION.test(run.charAt(index)) &&
    !LEADING_VOWEL.test(run.charAt(index - 1)));

function withRepeatMarks(run: string, end: number): number {
  let stop = end;
  while (run.charAt(stop) === REPEAT_MARK) stop += 1;
  return stop;
}

const isBetter = (step: Step, current: Step | undefined): boolean =>
  current === undefined ||
  step.unknownChars < current.unknownChars ||
  (step.unknownChars === current.unknownChars && step.words < current.words);

function bestSteps(run: string, { words, longest }: Dictionary): Step[] {
  const steps: Step[] = [];
  steps[0] = { from: 0, known: false, unknownChars: 0, words: 0 };
  const offer = (end: number, step: Step) => {
    if (isBetter(step, steps[end])) steps[end] = step;
  };
  for (let start = 0; start < run.length; start += 1) {
    const here = steps[start];
    if (here === undefined) continue;
    const limit = Math.min(run.length, start + longest);
    for (let end = start + 2; end <= limit; end += 1) {
      const stop = withRepeatMarks(run, end);
      if (isWordEdge(run, stop) && words.has(run.slice(start, end))) {
        offer(stop, {
          from: start,
          known: true,
          unknownChars: here.unknownChars,
          words: here.words + 1,
        });
      }
    }
    let next = start + 1;
    while (!isWordEdge(run, next)) next += 1;
    offer(next, {
      from: start,
      known: false,
      unknownChars: here.unknownChars + next - start,
      words: here.words + 1,
    });
  }
  return steps;
}

export function thaiSpans(run: string): ThaiSpan[] {
  const steps = bestSteps(run, dictionary);
  const spans: ThaiSpan[] = [];
  for (let end = run.length; end > 0;) {
    const { from, known } = steps[end];
    const after = spans[0];
    if (!known && after !== undefined && !after.known) {
      spans[0] = {
        text: run.slice(from, end) + after.text,
        index: from,
        known,
      };
    } else {
      spans.unshift({ text: run.slice(from, end), index: from, known });
    }
    end = from;
  }
  return spans;
}

const opensThaiWord = (word: string, next: string | undefined): boolean =>
  isThaiPrefix(word) &&
  next !== undefined &&
  THAI_CHARACTER.test(next) &&
  !isExtractionStopword(next);

export function attachThaiPrefixes(words: string[]): string[] {
  const attached: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const next = words[index + 1];
    if (opensThaiWord(words[index], next)) {
      attached.push(words[index] + next);
      index += 1;
    } else {
      attached.push(words[index]);
    }
  }
  return attached;
}
