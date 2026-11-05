import {
  ChartNoAxesColumn,
  ChartNoAxesColumnDecreasing,
  CircleOff,
  FileText,
  ListChecks,
  LogIn,
  MapPinOff,
  Medal,
  MessagesSquare,
  Sparkles,
  Star,
  StarHalf,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import type { AlertFeedEvent } from "@asobeast/shared";

export type AlertEventTone = "down" | "up" | "neutral";

interface AlertEventIcon {
  icon: LucideIcon;
  tone: AlertEventTone;
}

export const ALERT_EVENT_ICONS: Record<AlertFeedEvent, AlertEventIcon> = {
  "metadata.changed": { icon: FileText, tone: "neutral" },
  "rank.dropped": { icon: TrendingDown, tone: "down" },
  "rank.improved": { icon: TrendingUp, tone: "up" },
  "rank.milestone": { icon: Medal, tone: "neutral" },
  "rank.first": { icon: Sparkles, tone: "up" },
  "rank.overtaken": { icon: Swords, tone: "down" },
  "review.negative": { icon: Star, tone: "down" },
  "serp.entrant": { icon: LogIn, tone: "neutral" },
  "action.opened": { icon: ListChecks, tone: "neutral" },
  "chart.entered": { icon: ChartNoAxesColumn, tone: "up" },
  "chart.left": { icon: ChartNoAxesColumnDecreasing, tone: "down" },
  "chart.milestone": { icon: Trophy, tone: "neutral" },
  "rating.dropped": { icon: StarHalf, tone: "down" },
  "review.spike": { icon: MessagesSquare, tone: "neutral" },
  "app.delisted": { icon: CircleOff, tone: "down" },
  "app.unlisted_market": { icon: MapPinOff, tone: "down" },
};

export const ALERT_TONE_CLASS: Record<AlertEventTone, string> = {
  down: "text-destructive",
  up: "text-success",
  neutral: "text-muted-foreground",
};
