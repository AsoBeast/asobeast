"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  FileText,
  Gauge,
  History,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  Settings,
  Star,
  Swords,
  Tags,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/use-auth";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  APP_SECTIONS,
  type AppSectionSegment,
  appRouteFrom,
  isSectionActive,
  sectionHref,
} from "@/lib/app-sections";
import { actionSummaryOptions } from "@/lib/queries";

const SECTION_ICONS: Record<AppSectionSegment, LucideIcon> = {
  "": Gauge,
  actions: Lightbulb,
  keywords: Tags,
  rankings: TrendingUp,
  competitors: Swords,
  changes: History,
  reviews: Star,
  audit: ClipboardCheck,
  metadata: FileText,
};

const WORKSPACE = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/actions", label: "Action Center", icon: ListChecks },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const DISPLAY_MAX = 99;

function OpenActionBadge() {
  const { status } = useAuth();
  const { data } = useQuery({
    ...actionSummaryOptions,
    enabled: Boolean(status?.authenticated),
  });
  const open = data?.open ?? 0;
  if (open === 0) return null;

  return (
    <>
      <span className="sr-only">
        , {open} open action{open === 1 ? "" : "s"}
      </span>
      <SidebarMenuBadge aria-hidden className="numeric">
        {open > DISPLAY_MAX ? `${DISPLAY_MAX}+` : open}
      </SidebarMenuBadge>
    </>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const app = appRouteFrom(pathname);

  const close = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {WORKSPACE.map(({ href, label, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
                  tooltip={label}
                  isActive={pathname === href}
                >
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={pathname === href ? "page" : undefined}
                  >
                    <Icon />
                    <span>{label}</span>
                    {href === "/actions" ? <OpenActionBadge /> : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {app ? (
        <nav aria-label="App sections">
          <SidebarGroup>
            <SidebarGroupLabel>App</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {APP_SECTIONS.map(({ segment, label }) => {
                  const Icon = SECTION_ICONS[segment];
                  const active = isSectionActive(pathname, app.id, segment);
                  return (
                    <SidebarMenuItem key={segment || "overview"}>
                      <SidebarMenuButton
                        asChild
                        tooltip={label}
                        isActive={active}
                      >
                        <Link
                          href={sectionHref(app.id, segment)}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      ) : null}
    </>
  );
}
