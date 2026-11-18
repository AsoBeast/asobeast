"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import type { AuthUser } from "@asobeast/shared";
import { planInForceLabel } from "@/lib/plan-in-force";
import { ADMIN_ENTRY, ADMIN_TOOLS } from "@/components/admin/admin-links";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { useAuth } from "./use-auth";
import { useSignOut } from "./use-sign-out";

function PlanInForce({ user }: { user: AuthUser }) {
  return (
    <span data-slot="account-plan" className="text-caption font-normal">
      {`${planInForceLabel(user, new Date())} plan`}
    </span>
  );
}

export function UserMenu() {
  const { user } = useAuth();
  const signOut = useSignOut();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Account menu">
          <User />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span
            title={user.email}
            className="truncate text-dense text-foreground"
          >
            {user.email}
          </span>
          <PlanInForce user={user} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="sm:hidden">
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <ChangePasswordDialog
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Change password
            </DropdownMenuItem>
          }
        />
        {user.platformOperator && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-tick font-normal text-faint-foreground">
              Admin
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={ADMIN_ENTRY.href}>
                <ADMIN_ENTRY.icon />
                Admin area
              </Link>
            </DropdownMenuItem>
            {ADMIN_TOOLS.map(({ href, label, Icon }) => (
              <DropdownMenuItem key={href} asChild>
                <a href={href} target="_blank" rel="noreferrer">
                  <Icon />
                  {label}
                </a>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signOut.isPending}
          onSelect={(event) => {
            event.preventDefault();
            signOut.mutate();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
