import { pluralize } from "@/lib/format";
import type { KeywordFieldAdditionOutcome } from "@/lib/keyword-field-addition";
import { localizationName } from "@/lib/localizations";

function statusSentence({
  state,
  localization,
  count,
}: KeywordFieldAdditionOutcome): string {
  const name = localizationName(localization);
  switch (state) {
    case "added":
      return `Added ${pluralize(count, "phrase")} from the keywords page to the ${name} keyword field. Review them and save.`;
    case "managed":
      return `The selected phrases were not added, because App Store Connect manages the ${name} keyword field.`;
    case "unlisted":
      return `The selected phrases were not added, because this app does not list ${name}. Add it under Not listed yet, then send them again.`;
  }
}

export function KeywordFieldAdditionStatus({
  outcome,
}: {
  outcome: KeywordFieldAdditionOutcome;
}) {
  return (
    <p
      role="status"
      className="border-b border-border px-4 py-3 text-dense text-muted-foreground"
    >
      {statusSentence(outcome)}
    </p>
  );
}
