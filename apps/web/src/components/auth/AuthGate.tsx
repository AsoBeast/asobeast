"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { loginUrl } from "@/lib/api";
import { isPublicRoute } from "@/lib/auth-routes";
import { AccountNotice } from "./AccountNotice";
import { SessionCheck } from "./SessionCheck";
import { useAuth } from "./use-auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, isFetching } = useAuth();
  const isPublic = isPublicRoute(pathname);
  const blocked = Boolean(status && !status.authenticated && !isPublic);

  useEffect(() => {
    if (blocked && !isFetching) {
      window.location.replace(
        loginUrl(window.location.pathname, window.location.search),
      );
    }
  }, [blocked, isFetching]);

  if (blocked) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6"
      >
        <SessionCheck />
      </main>
    );
  }

  return (
    <>
      {isPublic ? null : <AccountNotice />}
      {children}
    </>
  );
}
