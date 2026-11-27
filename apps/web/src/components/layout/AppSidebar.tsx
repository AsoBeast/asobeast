import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
import { PRODUCT_NAME } from "@/lib/brand";
import { latestShown } from "@/lib/whats-new/release-notes";
import { RELEASES } from "@/lib/whats-new/releases";
import { appVersion, appVersionLabel, releaseNotesUrl } from "./app-version";
import { AppSwitcher } from "./AppSwitcher";
import { SidebarLegalLinks } from "./SidebarLegalLinks";
import { SidebarNav } from "./SidebarNav";
import { WhatsNewMenuItem } from "./WhatsNewMenuItem";

const DOCUMENTATION_URL = "https://docs.asobeast.com";

export function AppSidebar() {
  const t = useTranslations("navigation");
  const shell = useTranslations("shell");
  const version = appVersionLabel();
  const latest = latestShown(RELEASES, appVersion());

  return (
    <Sidebar collapsible="icon">
      <nav aria-label={t("main")} className="flex min-h-0 flex-1 flex-col">
        <SidebarHeader>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md p-2 text-heading focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none group-data-[collapsible=icon]:p-1.5"
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
              {PRODUCT_NAME}
            </span>
          </Link>
          <AppSwitcher />
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav />
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <WhatsNewMenuItem latest={latest} />
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={t("documentation")}>
                <a
                  href={DOCUMENTATION_URL}
                  data-nav="documentation"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <BookOpen />
                  <span>{t("documentation")}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="px-2 pb-1 text-caption text-faint-foreground group-data-[collapsible=icon]:hidden">
            <p>{shell("tagline")}</p>
            <SidebarLegalLinks />
            {version ? (
              <p>
                <a
                  href={releaseNotesUrl(version)}
                  rel="noreferrer noopener"
                  target="_blank"
                  title={t("releaseNotes")}
                  className="rounded-sm underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                >
                  <span translate="no">{version}</span>
                  <span className="sr-only"> {t("releaseNotes")}</span>
                </a>
              </p>
            ) : null}
          </div>
        </SidebarFooter>
      </nav>

      <SidebarRail />
    </Sidebar>
  );
}
