"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileJson, ListChecks, LogOut, Settings, User } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/lib/api";
import { invalidateAuth } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
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

const ADMIN_LINKS = [
  { href: "/admin/queues", label: "Queue dashboard", Icon: ListChecks },
  { href: "/docs", label: "API docs", Icon: FileJson },
] as const;

export function UserMenu() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const signOut = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      invalidateAuth(queryClient);
      window.location.replace("/login");
    },
    onError: () => toast.error("Could not sign out."),
  });

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Account menu">
          <User />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate font-medium">{user.email}</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {user.plan}
          </Badge>
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
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Admin
            </DropdownMenuLabel>
            {ADMIN_LINKS.map(({ href, label, Icon }) => (
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
