import {
  CircleCheck,
  CircleDashed,
  CircleX,
  TriangleAlert,
} from "lucide-react";
import type { AuditCheckStatus } from "@asobeast/shared";

export const STATUS_ICON: Record<AuditCheckStatus, typeof CircleCheck> = {
  pass: CircleCheck,
  warn: TriangleAlert,
  fail: CircleX,
  unanswered: CircleDashed,
};

export const STATUS_TONE: Record<AuditCheckStatus, string> = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
  unanswered: "text-muted-foreground",
};
