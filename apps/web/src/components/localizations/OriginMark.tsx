import type { AppLocalizationOrigin } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";

export function OriginBadge({ origin }: { origin: AppLocalizationOrigin }) {
  if (origin === "home") return <Badge variant="outline">Home</Badge>;
  if (origin === "detected") return <Badge variant="brand">Detected</Badge>;
  return null;
}
