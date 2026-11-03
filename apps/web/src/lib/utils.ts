import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

export const TYPE_STEPS = [
  "hero",
  "display",
  "title",
  "subtitle",
  "body",
  "label",
  "caption",
  "numeric",
] as const;

const twMerge = extendTailwindMerge({
  extend: { theme: { text: [...TYPE_STEPS] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
