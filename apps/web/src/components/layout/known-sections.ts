import { COMPETITOR_SECTIONS } from "@/components/competitors/competitor-sections";
import { KEYWORD_SECTIONS } from "@/components/keywords/keyword-sections";
import { OVERVIEW_SECTIONS } from "@/components/overview/overview-sections";

export const KNOWN_SECTIONS: readonly string[] = [
  ...COMPETITOR_SECTIONS,
  ...KEYWORD_SECTIONS,
  ...OVERVIEW_SECTIONS,
];
