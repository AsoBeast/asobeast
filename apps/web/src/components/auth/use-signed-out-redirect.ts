"use client";

import { useEffect } from "react";
import { loginUrl } from "@/lib/api";
import { useAuth } from "./use-auth";

export function useSignedOutRedirect(active: boolean): boolean {
  const { status, isFetching } = useAuth();
  const signedOut = active && Boolean(status && !status.authenticated);

  useEffect(() => {
    if (signedOut && !isFetching) {
      window.location.replace(
        loginUrl(window.location.pathname, window.location.search),
      );
    }
  }, [signedOut, isFetching]);

  return signedOut;
}
