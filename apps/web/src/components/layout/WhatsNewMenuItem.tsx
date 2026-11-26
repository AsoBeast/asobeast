"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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

export function WhatsNewMenuItem({ latest }: { latest: string | null }) {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const [seen] = useSeenRelease();
  const { isMobile, setOpenMobile } = useSidebar();
  const unread = hasUnseenRelease(latest, seen);
  const name = t(unread ? "whatsNewUnread" : "whatsNew");

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
              "absolute top-1.5 left-[1.125rem] size-2 rounded-full bg-brand-mark ring-2 ring-sidebar",
              !unread && "hidden",
            )}
          />
          <Megaphone />
          <span>{t("whatsNew")}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
