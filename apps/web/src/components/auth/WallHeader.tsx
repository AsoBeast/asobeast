"use client";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { SignOutButton } from "./SignOutButton";
import { useAuth } from "./use-auth";

export function WallHeader() {
  const { user } = useAuth();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ThemeToggle />
      {user ? (
        <span className="sr-only truncate text-body text-muted-foreground sm:not-sr-only">
          {user.email}
        </span>
      ) : null}
      <SignOutButton variant="ghost" size="sm" />
    </div>
  );
}
