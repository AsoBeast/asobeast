import { PRODUCT_NAME } from "@/lib/brand";

const MAX_PART_LENGTH = 40;
const FILENAME_PREFIX = PRODUCT_NAME.toLowerCase();

export function slugPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_PART_LENGTH)
    .replace(/-+$/, "");
}

export interface ChartImageName {
  chart: "rankings" | "position-history";
  appName: string | null;
  appId: string;
  keyword?: string;
  from: string;
  to: string;
}

export function chartImageFilename(name: ChartImageName): string {
  const app = slugPart(name.appName ?? "") || slugPart(name.appId);
  const parts = [
    FILENAME_PREFIX,
    name.chart,
    app,
    slugPart(name.keyword ?? ""),
    name.from,
    name.to,
  ].filter((part) => part !== "");
  return `${parts.join("-")}.png`;
}
