import { Sparkles, TrendingUp, Wrench, type LucideIcon } from "lucide-react";
import type { ReleaseKind } from "@/lib/whats-new/release-notes";

export interface ReleaseKindDisplay {
  label: string;
  icon: LucideIcon;
  badge: "info" | "success" | "secondary";
}

export const RELEASE_KIND_DISPLAY: Record<ReleaseKind, ReleaseKindDisplay> = {
  new: { label: "New", icon: Sparkles, badge: "info" },
  improved: { label: "Improved", icon: TrendingUp, badge: "success" },
  fixed: { label: "Fixed", icon: Wrench, badge: "secondary" },
};
