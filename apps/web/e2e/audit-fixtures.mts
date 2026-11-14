import type { AuditScorePoint } from "@asobeast/shared";
import { AUDIT_HISTORY_POINTS, utcDaysAgo } from "./fixtures.mts";

const RISING_SCORES = [
  61.8, 61.8, 62.4, 62.4, 63.0, 65.1, 65.1, 66.3, 68.4, 68.4, 70.9, 72.5, 74.2,
];

const FALLING_SCORES = [
  61.4, 61.4, 61.4, 61.0, 61.0, 61.0, 60.2, 60.2, 59.6, 59.6, 58.9, 58.2, 58.2,
];

const RUBRIC_V2_FROM = 5;
const RUBRIC_V3_FROM = 10;

const rubricAt = (index: number): string =>
  index >= RUBRIC_V3_FROM ? "v3" : index >= RUBRIC_V2_FROM ? "v2" : "v1";

const dailyHistory = (
  scores: number[],
  version: (index: number) => string,
  confidence: number,
): AuditScorePoint[] =>
  scores.map((overall, index) => ({
    date: utcDaysAgo(scores.length - index),
    overall,
    coveredWeight: 95,
    totalWeight: 110,
    rubricVersion: version(index),
    confidence,
  }));

const RISING_AUDIT_HISTORY = dailyHistory(RISING_SCORES, rubricAt, 0.82);

const FALLING_AUDIT_HISTORY = dailyHistory(FALLING_SCORES, () => "v3", 0.55);

export function auditHistoryFor(
  id: string,
  provisional: boolean,
): AuditScorePoint[] {
  if (id === "app-gp") return AUDIT_HISTORY_POINTS;
  if (id === "app-long") return AUDIT_HISTORY_POINTS.slice(-1);
  if (id !== "app-1") return [];
  return provisional ? FALLING_AUDIT_HISTORY : RISING_AUDIT_HISTORY;
}
