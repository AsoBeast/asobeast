import { TriangleAlert } from "lucide-react";
import type { AppDetail } from "@asobeast/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCountry, formatDate, storeLabel } from "@/lib/format";

export function DelistedNotice({
  detail,
  since,
}: {
  detail: AppDetail;
  since: string;
}) {
  const store = storeLabel(detail.store);
  return (
    <Alert variant="warning" role="note">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>No longer listed on {store}</AlertTitle>
      <AlertDescription>
        <p>
          Since {formatDate(since)}, {store} answers that it has no app{" "}
          {detail.storeAppId} in {formatCountry(detail.country)}. The stored
          history stays, and every daily run checks again, so this notice clears
          on the first capture that finds the app.
        </p>
        <p>
          Open the store page to check. If the app moved to a new store id,
          import it again from its new link. If it is gone for good,{" "}
          {detail.isCompetitor
            ? "remove it from the competitors of the app that tracks it."
            : "delete it from the dashboard."}
        </p>
      </AlertDescription>
    </Alert>
  );
}
