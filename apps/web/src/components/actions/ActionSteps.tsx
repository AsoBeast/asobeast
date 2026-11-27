import type { ActionItem } from "@asobeast/shared";
import { useAppLocale } from "@/lib/use-app-locale";
import { actionSteps } from "./action-steps";

export function ActionSteps({ item }: { item: ActionItem }) {
  const locale = useAppLocale();
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-6 text-body">
      {actionSteps(item, locale).map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}
