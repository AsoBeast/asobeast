import Link from "next/link";
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
      <AlertTitle>Your browser did not keep the session cookie</AlertTitle>
      <AlertDescription className="[&_p:not(:last-child)]:mb-1">
        <p>
          {outcome} Open AsoBeast over https or allow cookies for this site,
          then sign in again.
        </p>
        <p>
          The{" "}
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
