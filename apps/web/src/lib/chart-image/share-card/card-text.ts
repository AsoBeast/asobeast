import { clipText, type Measure } from "@/lib/text-fit";
import { quotedTerm } from "./headline";

export interface FittedText {
  text: string;
  size: number;
}

const SHRINK_STEP = 0.9;
const SMALLEST_SHARE = 0.7;
const FIRST_STRONG = /\p{L}/u;
const RIGHT_TO_LEFT =
  /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;

export function fitCardText(
  text: string,
  maxWidth: number,
  size: number,
  measureAt: (size: number) => Measure,
): FittedText {
  const smallest = size * SMALLEST_SHARE;
  let current = size;
  while (
    current * SHRINK_STEP >= smallest &&
    measureAt(current)(text) > maxWidth
  ) {
    current *= SHRINK_STEP;
  }
  return { text: clipText(text, maxWidth, measureAt(current)), size: current };
}

const isolated = (text: string) => `\u2068${text}\u2069`;

export function fitLead(
  { prefix, term }: { prefix: string; term: string },
  maxWidth: number,
  size: number,
  measureAt: (size: number) => Measure,
): FittedText {
  const whole = quotedTerm(isolated(term));
  const fitted = fitCardText(`${prefix}${whole}`, maxWidth, size, measureAt);
  const measure = measureAt(fitted.size);
  if (measure(`${prefix}${whole}`) <= maxWidth) {
    return { text: whole, size: fitted.size };
  }
  const room = maxWidth - measure(prefix) - measure(quotedTerm(""));
  return {
    text: quotedTerm(isolated(clipText(term, room, measure))),
    size: fitted.size,
  };
}

export function textDirection(text: string): "ltr" | "rtl" {
  const strong = FIRST_STRONG.exec(text)?.[0];
  return strong !== undefined && RIGHT_TO_LEFT.test(strong) ? "rtl" : "ltr";
}
