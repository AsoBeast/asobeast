import { normalizeText } from "@asobeast/shared";

export function searchText(value: string): string {
  return normalizeText(value).normalize("NFD").replace(/\p{M}/gu, "");
}

export function matchesSearch(
  parts: readonly string[],
  query: string,
): boolean {
  const needle = searchText(query);
  return needle === "" || searchText(parts.join(" ")).includes(needle);
}
