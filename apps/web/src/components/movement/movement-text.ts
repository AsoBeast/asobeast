import type { ChartMovement } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enFormat from "../../../messages/en/format.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "format",
  messages: { format: enFormat },
});

export interface Moved {
  movement: ChartMovement;
  delta: number | null;
  previous: number | null;
}

export function movementText(
  { movement, delta, previous }: Moved,
  noneText?: string,
  t: MessageTranslator = english,
): string {
  if (movement === "up") {
    return t("movement.up", {
      count: Math.abs(delta ?? 0),
      previous: previous ?? "—",
    });
  }
  if (movement === "down") {
    return t("movement.down", { count: delta ?? 0, previous: previous ?? "—" });
  }
  if (movement === "same") return t("movement.same");
  if (movement === "new") return t("movement.new");
  return noneText ?? t("movement.noEarlier");
}
