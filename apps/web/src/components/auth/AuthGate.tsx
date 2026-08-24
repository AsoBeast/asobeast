"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isPublicRoute } from "@/lib/auth-routes";
import { useAuth } from "./use-auth";

function daysLeft(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, trialOnly, isFetching } = useAuth();
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

  const trialEndsAt = user?.trialEndsAt;
  const remaining =
    !isPublic && trialOnly && trialEndsAt ? daysLeft(trialEndsAt) : null;
  const lapsed = Boolean(!isPublic && user && !user.entitled);

  return (
    <>
      {lapsed ? (
        <div className="flex items-center justify-between gap-4 border-b bg-muted px-4 py-2 text-body sm:px-6">
          <span>
            Collection is paused. Everything asobeast has already gathered stays
            readable and exportable.
          </span>
          <Link href="/upgrade" className="font-medium underline">
            Choose a plan
          </Link>
        </div>
      ) : null}
      {remaining !== null ? (
        <div className="flex items-center justify-between gap-4 border-b border-warning/30 bg-warning-subtle px-4 py-2 text-body text-warning sm:px-6">
          <span>
            Trial ends in {remaining} day{remaining === 1 ? "" : "s"}.
          </span>
          <Link href="/upgrade" className="font-medium underline">
            Upgrade
          </Link>
        </div>
      ) : null}
      {children}
    </>
  );
}
