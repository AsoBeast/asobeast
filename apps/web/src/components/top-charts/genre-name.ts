import { OVERALL_GENRE } from "@asobeast/shared";
import enTopCharts from "../../../messages/en/topCharts.json";
import zhTopCharts from "../../../messages/zh-CN/topCharts.json";
import type { Locale } from "@/lib/locale";

export function genreNameInLocale(name: string, locale: Locale): string {
  if (name.toLowerCase() !== OVERALL_GENRE) return name;
  return locale === "zh-CN"
    ? zhTopCharts.genres.overall
    : enTopCharts.genres.overall;
}
