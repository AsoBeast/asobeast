import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { AppSwitcher } from "./AppSwitcher";
import { SidebarNav } from "./SidebarNav";

export function AppSidebar() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col">
        <SidebarHeader>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md p-2 text-title focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 focus-visible:outline-none group-data-[collapsible=icon]:p-1.5"
          >
            <Image
              src="/brand/mark.png"
              alt=""
              width={24}
              height={24}
              priority
              className="shrink-0 rounded-[6px]"
            />
            <span
              translate="no"
              className="truncate group-data-[collapsible=icon]:hidden"
            >
              asobeast
            </span>
          </Link>
          <AppSwitcher />
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Documentation">
                <a
                  href="https://github.com/AsoBeast/asobeast"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <BookOpen />
                  <span>Documentation</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <p className="px-2 pb-1 text-caption text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Self hosted ASO toolkit for the App Store and Google Play.
          </p>
        </SidebarFooter>
      </nav>

      <SidebarRail />
    </Sidebar>
  );
}
