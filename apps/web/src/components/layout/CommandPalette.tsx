"use client";

import { useQuery } from "@tanstack/react-query";
import { INTEGRATIONS_PATH } from "@asobeast/shared";
import {
  Bell,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Plug,
  ScanSearch,
  Search,
  Settings,
  Trophy,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { ADMIN_ENTRY } from "@/components/admin/admin-links";
import { useAuth } from "@/components/auth/use-auth";
import { WHATS_NEW_PATH } from "./WhatsNewMenuItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { storeLabel } from "@/lib/format";
import {
  APP_SECTIONS,
  appRouteFrom,
  equivalentSection,
  sectionHref,
} from "@/lib/app-sections";
import { appsOptions } from "@/lib/queries";

const GENERAL = [
  { href: "/", label: "dashboard", icon: LayoutDashboard },
  { href: "/actions", label: "actionCenter", icon: ListChecks },
  { href: "/alerts", label: "alerts", icon: Bell },
  { href: "/charts", label: "topCharts", icon: Trophy },
  { href: "/inspect", label: "keywordInspector", icon: ScanSearch },
  { href: INTEGRATIONS_PATH, label: "integrations", icon: Plug },
  { href: WHATS_NEW_PATH, label: "whatsNew", icon: Megaphone },
  { href: "/settings", label: "settings", icon: Settings },
] as const;

export function CommandPalette() {
  const t = useTranslations("navigation");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const route = appRouteFrom(pathname);
  const appId = route?.id;
  const { data: apps } = useQuery({ ...appsOptions, enabled: open });
  const { isOperator } = useAuth();
  const general = isOperator
    ? [
        ...GENERAL,
        { href: ADMIN_ENTRY.href, label: "admin", icon: ADMIN_ENTRY.icon },
      ]
    : GENERAL;

  const openRef = useRef(open);

  const handleOpenChange = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (!next) setQuery("");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleOpenChange(!openRef.current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleOpenChange]);

  const go = useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [handleOpenChange, router],
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            data-action="open-command-palette"
            aria-label={t("openCommandPalette")}
            onClick={() => handleOpenChange(true)}
          >
            <Search />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("searchShortcut")}</TooltipContent>
      </Tooltip>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={t("commandPaletteTitle")}
        description={t("commandPaletteDescription")}
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("commandPaletteSearch")}
          />
          <CommandList>
            <CommandEmpty>{t("noMatches")}</CommandEmpty>

            {apps && apps.length > 0 ? (
              <CommandGroup heading={t("apps")}>
                {apps.map((item) => {
                  const name = item.name ?? t("untitledApp");
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${name} ${storeLabel(item.store)} ${item.country}`}
                      onSelect={() =>
                        go(
                          sectionHref(
                            item.id,
                            equivalentSection(route?.segment ?? ""),
                          ),
                        )
                      }
                    >
                      <AppIcon src={item.iconUrl} size={20} />
                      <span className="truncate">{name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {storeLabel(item.store)}
                      </Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {appId ? (
              <CommandGroup heading={t("sections")}>
                {APP_SECTIONS.map((section) => {
                  const label = t(
                    `appSections.${section.segment || "overview"}`,
                  );
                  return (
                    <CommandItem
                      key={section.segment || "overview"}
                      value={`section ${label}`}
                      onSelect={() => go(sectionHref(appId, section.segment))}
                    >
                      {label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            <CommandGroup heading={t("general")}>
              {general.map((entry) => {
                const label = t(entry.label);
                return (
                  <CommandItem
                    key={entry.href}
                    value={label}
                    onSelect={() => go(entry.href)}
                  >
                    <entry.icon />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
