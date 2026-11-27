"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSingleFlight } from "@/lib/single-flight";
import { useSignOut } from "./use-sign-out";

export function SignOutButton(
  props: Pick<
    ComponentProps<typeof Button>,
    "variant" | "size" | "className"
  > & {
    children?: ReactNode;
  },
) {
  const t = useTranslations("auth");
  const signOut = useSignOut();
  const signOutOnce = useSingleFlight(signOut);
  const locked = signOut.isPending || signOut.isSuccess;

  return (
    <Button
      {...props}
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!locked) signOutOnce();
      }}
    >
      {props.children ?? t("signOut")}
    </Button>
  );
}
