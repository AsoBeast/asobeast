import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TROUBLESHOOTING_URL =
  "https://docs.asobeast.com/operations/troubleshooting#signing-in-returns-to-the-sign-in-form";

const SYMPTOM = "Signing in returns to the sign in form";

export function SessionNotKeptAlert({
  outcome,
  offerSignIn = false,
}: {
  outcome: string;
  offerSignIn?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Your browser did not keep the session cookie</AlertTitle>
      <AlertDescription>
        <p>
          {outcome} A secure cookie is dropped on plain http, even on localhost
          in Safari, and a browser that blocks cookies for this site drops it
          too. Open AsoBeast over https, allow cookies for this site, or use
          another browser, then sign in again. The{" "}
          <a href={TROUBLESHOOTING_URL} target="_blank" rel="noreferrer">
            troubleshooting guide
          </a>{" "}
          covers it under &quot;{SYMPTOM}&quot;.
        </p>
        {offerSignIn ? (
          <p>
            <Link href="/login">Go to sign in</Link>
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
