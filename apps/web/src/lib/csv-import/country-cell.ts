import { COUNTRY_NAMES } from "@/lib/country-names";

const FIRST_REGIONAL_INDICATOR = 0x1f1e6;
const LAST_REGIONAL_INDICATOR = 0x1f1ff;
const LETTER_A = "a".charCodeAt(0);
const CODE_PATTERN = /^[a-z]{2}$/i;

const NAME_ALTERNATES: Readonly<Record<string, string>> = {
  usa: "us",
  unitedstatesofamerica: "us",
  uk: "gb",
  greatbritain: "gb",
  turkey: "tr",
  czechrepublic: "cz",
  korea: "kr",
  republicofkorea: "kr",
  russianfederation: "ru",
  ivorycoast: "ci",
  myanmar: "mm",
  burma: "mm",
  macedonia: "mk",
  swaziland: "sz",
};

function nameKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "");
}

const CODE_BY_NAME: ReadonlyMap<string, string> = new Map([
  ...Object.entries(COUNTRY_NAMES).map(
    ([code, name]) => [nameKey(name), code] as const,
  ),
  ...Object.entries(NAME_ALTERNATES),
]);

const isRegionalIndicator = (point: number | undefined): point is number =>
  point !== undefined &&
  point >= FIRST_REGIONAL_INDICATOR &&
  point <= LAST_REGIONAL_INDICATOR;

function flagCode(cell: string): string | null {
  const [first, second] = Array.from(cell, (char) => char.codePointAt(0));
  if (!isRegionalIndicator(first) || !isRegionalIndicator(second)) return null;
  return [first, second]
    .map((point) =>
      String.fromCharCode(LETTER_A + point - FIRST_REGIONAL_INDICATOR),
    )
    .join("");
}

export function countryFromCell(cell: string): string {
  const text = cell.trim();
  const named = CODE_BY_NAME.get(nameKey(text));
  if (CODE_PATTERN.test(text) && named === undefined) return text;
  return flagCode(text) ?? named ?? text;
}
