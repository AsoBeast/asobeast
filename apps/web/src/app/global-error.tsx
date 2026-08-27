"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          colorScheme: "light dark",
          textAlign: "center",
        }}
      >
        <title>Something went wrong · asobeast</title>
        <h1 style={{ fontSize: "1rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "28rem", opacity: 0.7 }}>
          asobeast could not render this page. Trying again usually clears a
          transient failure.
        </p>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </body>
    </html>
  );
}
