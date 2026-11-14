import type { EssentialAlertsNeed } from "@asobeast/shared";
import { essentialNeedCopy, HTTPS_VARIABLE } from "./essential-alerts-copy";

export function EssentialAlertsNotice({
  need,
}: {
  need: EssentialAlertsNeed | null | undefined;
}) {
  const copy = essentialNeedCopy(need);
  if (!copy) return null;
  const [before, after] = copy.split(HTTPS_VARIABLE);
  return (
    <p className="text-body text-muted-foreground">
      {after === undefined ? (
        copy
      ) : (
        <>
          <span>{before}</span>
          <code className="font-mono text-caption text-foreground">
            {HTTPS_VARIABLE}
          </code>
          <span>{after}</span>
        </>
      )}
    </p>
  );
}
