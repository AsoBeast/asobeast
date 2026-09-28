import type { ActionItem } from "@asobeast/shared";
import { actionSteps } from "./action-steps";

export function ActionSteps({ item }: { item: ActionItem }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-6 text-body">
      {actionSteps(item).map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}
