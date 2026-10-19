"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isPublicRoute } from "@/lib/auth-routes";
import { AccountNotice } from "./AccountNotice";
import { SessionCheck } from "./SessionCheck";
import { useSignedOutRedirect } from "./use-signed-out-redirect";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);
  const blocked = useSignedOutRedirect(!isPublic);

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
