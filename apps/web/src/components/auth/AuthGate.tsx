"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isPublicRoute } from "@/lib/auth-routes";
import { AccountNotice } from "./AccountNotice";
import { useAuth } from "./use-auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, isFetching } = useAuth();
  const isPublic = isPublicRoute(pathname);
  const blocked = Boolean(status && !status.authenticated && !isPublic);

  useEffect(() => {
    if (blocked && !isFetching) {
      router.replace("/login");
    }
  }, [blocked, isFetching, router]);

  if (blocked) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6"
      >
        <div role="status" aria-label="Checking your session">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
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
