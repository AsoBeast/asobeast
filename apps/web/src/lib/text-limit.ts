import { countMaxLengthChars } from "@asobeast/shared";

export interface TextLimit {
  used: number;
  over: number;
}

export function textLimit(text: string, limit: number): TextLimit {
  const used = countMaxLengthChars(text);
  return { used, over: Math.max(0, used - limit) };
}

export function limitCounterText(counter: TextLimit, limit: number): string {
  const base = `${counter.used} / ${limit}`;
  return counter.over > 0 ? `${base} · ${counter.over} over the limit` : base;
}
