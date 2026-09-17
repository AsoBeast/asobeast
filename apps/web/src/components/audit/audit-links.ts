import type { AuditTarget, AuditUnlockKind } from "@asobeast/shared";

const TARGET_PATH: Record<AuditTarget, string | null> = {
  metadata: "metadata",
  keywords: "keywords",
  competitors: "competitors",
  reviews: "reviews",
  rankings: "rankings",
  "store-console": null,
  "ai-analysis": "#ai-analysis",
};

const UNLOCK_PATH: Record<AuditUnlockKind, string> = {
  "ai-analysis": "#ai-analysis",
  "keyword-field": "keywords",
  keywords: "keywords",
  competitors: "competitors",
  history: "rankings",
  reviews: "reviews",
};

const hrefFor = (appId: string, path: string): string =>
  path.startsWith("#") ? path : `/apps/${appId}/${path}`;

export function targetHref(appId: string, target: AuditTarget): string | null {
  const path = TARGET_PATH[target];
  return path === null ? null : hrefFor(appId, path);
}

export function unlockHref(appId: string, kind: AuditUnlockKind): string {
  return hrefFor(appId, UNLOCK_PATH[kind]);
}
