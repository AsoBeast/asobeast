import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TROUBLESHOOTING_URL =
  "https://docs.asobeast.com/operations/troubleshooting#signing-in-returns-to-the-sign-in-form";

const SYMPTOM = "Signing in returns to the sign in form";

export function SessionNotKeptAlert({ outcome }: { outcome: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Your browser did not keep the session cookie</AlertTitle>
      <AlertDescription>
        {outcome} A secure cookie is dropped on plain http, even on localhost in
        Safari, and a browser that blocks cookies for this site drops it too.
        Open asobeast over https, allow cookies for this site, or use another
        browser, then sign in again. The{" "}
        <a href={TROUBLESHOOTING_URL} target="_blank" rel="noreferrer">
          troubleshooting guide
        </a>{" "}
        covers it under &quot;{SYMPTOM}&quot;.
      </AlertDescription>
    </Alert>
  );
}
