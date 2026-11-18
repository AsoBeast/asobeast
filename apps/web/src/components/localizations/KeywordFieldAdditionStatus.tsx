import { pluralize } from "@/lib/format";
import {
  additionNotice,
  type KeywordFieldAddition,
  type KeywordFieldAdditionOutcome,
} from "@/lib/keyword-field-addition";
import { localizationName } from "@/lib/localizations";

function receivedSentence(
  addition: KeywordFieldAddition,
  name: string,
): string | null {
  const notice = additionNotice(addition, name);
  if (addition.added.length === 0) return notice;
  const added = `Added ${pluralize(addition.added.length, "phrase")} from the keywords page to the ${name} keyword field. Review them and save.`;
  return notice ? `${added} ${notice}` : added;
}

function statusSentence(outcome: KeywordFieldAdditionOutcome): string | null {
  const name = localizationName(outcome.localization);
  switch (outcome.state) {
    case "received":
      return receivedSentence(outcome.addition, name);
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
  const sentence = statusSentence(outcome);
  if (!sentence) return null;
  return (
    <p
      role="status"
      className="border-b border-border px-4 py-3 text-dense text-muted-foreground"
    >
      {sentence}
    </p>
  );
}
