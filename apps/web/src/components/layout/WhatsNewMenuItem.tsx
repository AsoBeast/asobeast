"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone } from "lucide-react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { hasUnseenRelease } from "@/lib/whats-new/release-notes";
import { useSeenRelease } from "@/lib/whats-new/seen-release";

export const WHATS_NEW_PATH = "/whats-new";
export const WHATS_NEW_LABEL = "What's New";
const UNREAD_SUFFIX = ", new updates";

export function WhatsNewMenuItem({ latest }: { latest: string | null }) {
  const pathname = usePathname();
  const [seen] = useSeenRelease();
  const { isMobile, setOpenMobile } = useSidebar();
  const unread = hasUnseenRelease(latest, seen);
  const name = unread ? `${WHATS_NEW_LABEL}${UNREAD_SUFFIX}` : WHATS_NEW_LABEL;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={pathname === WHATS_NEW_PATH}
        tooltip={name}
        className="relative"
      >
        <Link
          href={WHATS_NEW_PATH}
          aria-label={name}
          data-unread={unread}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
        >
          <span
            aria-hidden
            data-slot="unread-dot"
            className={cn(
              "absolute top-1.5 left-[1.125rem] size-2 rounded-full bg-destructive ring-2 ring-sidebar",
              !unread && "hidden",
            )}
          />
          <Megaphone />
          <span>{WHATS_NEW_LABEL}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
