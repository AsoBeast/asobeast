import type { ChangeField } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enChanges from "../../messages/en/changes.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

export function changeFieldLabel(
  field: ChangeField,
  t: MessageTranslator = english,
): string {
  return t(`fields.${field}`);
}
