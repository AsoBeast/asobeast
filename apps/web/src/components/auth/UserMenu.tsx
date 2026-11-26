"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogOut, Settings, User } from "lucide-react";
import type { AuthUser } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import { planInForceLabel } from "@/lib/plan-in-force";
import { useAppLocale } from "@/lib/use-app-locale";
import { ADMIN_ENTRY, ADMIN_TOOLS } from "@/components/admin/admin-links";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
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
  const billing = useTranslations("billing");
  const account = useTranslations("account");
  const locale = useAppLocale();

  return (
    <span data-slot="account-plan" className="text-caption font-normal">
      {account("menu.plan", {
        plan: planInForceLabel(user, new Date(), {
          translator: billing,
          locale,
        }),
      })}
    </span>
  );
}

function adminToolLabel(href: string, t: MessageTranslator) {
  return href === "/admin/queues"
    ? t("menu.queueDashboard")
    : t("menu.apiDocs");
}

export function UserMenu() {
  const account = useTranslations("account");
  const auth = useTranslations("auth");
  const navigation = useTranslations("navigation");
  const { user } = useAuth();
  const signOut = useSignOut();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={account("menu.account")}
        >
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
        <div className="px-2 py-1.5">
          <LanguageSwitcher className="w-full justify-between border-0 bg-transparent" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="sm:hidden">
          <Link href="/settings">
            <Settings />
            <span>{navigation("settings")}</span>
          </Link>
        </DropdownMenuItem>
        <ChangePasswordDialog
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              <span>{auth("password.changeTitle")}</span>
            </DropdownMenuItem>
          }
        />
        {user.platformOperator && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-tick font-normal text-faint-foreground">
              {navigation("admin")}
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={ADMIN_ENTRY.href}>
                <ADMIN_ENTRY.icon />
                <span>{account("menu.adminArea")}</span>
              </Link>
            </DropdownMenuItem>
            {ADMIN_TOOLS.map(({ href, Icon }) => (
              <DropdownMenuItem key={href} asChild>
                <a href={href} target="_blank" rel="noreferrer">
                  <Icon />
                  <span>{adminToolLabel(href, account)}</span>
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
          <span>{auth("signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
