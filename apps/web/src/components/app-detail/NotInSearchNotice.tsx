import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function NotInSearchNotice() {
  return (
    <Alert variant="warning" className="print:hidden">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Not listed in iPhone search</AlertTitle>
      <AlertDescription>
        This app is not available on iPhone, and asobeast reads iPhone search,
        so no keyword position can be found for it. Its positions stay above the
        checked depth and its visibility stays at 0.
      </AlertDescription>
    </Alert>
  );
}
