"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, Plus } from "lucide-react";
import type { AppListItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  appRouteFrom,
  equivalentSection,
  sectionHref,
} from "@/lib/app-sections";
import { storeLabel } from "@/lib/format";
import { appsOptions } from "@/lib/queries";

type Translator = ReturnType<typeof useTranslations>;

function appLabel(app: AppListItem, t: Translator): string {
  return app.name ?? t("untitledApp");
}

function appMarket(app: AppListItem): string {
  return `${storeLabel(app.store)} · ${app.country.toUpperCase()}`;
}

function TriggerLabel({
  current,
  subtitle,
  t,
}: {
  current: AppListItem | undefined;
  subtitle: string;
  t: Translator;
}) {
  return (
    <>
      {current ? (
        <AppIcon src={current.iconUrl} size={24} />
      ) : (
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-caption font-medium"
        >
          ⌘
        </span>
      )}
      <span className="grid min-w-0 flex-1 text-left leading-tight">
        <span className="truncate font-medium">
          {current ? appLabel(current, t) : t("allApps")}
        </span>
        <span className="truncate text-caption text-muted-foreground">
          {current ? appMarket(current) : subtitle}
        </span>
      </span>
      <ChevronsUpDown className="ml-auto" />
    </>
  );
}

function ImportEntry() {
  const t = useTranslations("navigation");
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <ImportAppDialog>
          <SidebarMenuButton size="lg" tooltip={t("importApp")}>
            <Plus />
            <span className="font-medium">{t("importApp")}</span>
          </SidebarMenuButton>
        </ImportAppDialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSwitcher() {
  const t = useTranslations("navigation");
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: apps, isPending, isError } = useQuery(appsOptions);

  const route = appRouteFrom(pathname);
  const current = route ? apps?.find((app) => app.id === route.id) : undefined;
  const subtitle = apps
    ? t("trackedCount", { count: apps.length })
    : isError
      ? t("couldNotLoadApps")
      : t("loadingApps");

  function select(appId: string) {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
    router.push(sectionHref(appId, equivalentSection(route?.segment ?? "")));
  }

  if (!isPending && apps?.length === 0) return <ImportEntry />;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              ref={trigger}
              size="lg"
              aria-label={
                current
                  ? t("switchAppCurrent", { name: appLabel(current, t) })
                  : t("chooseApp")
              }
              tooltip={current ? appLabel(current, t) : t("allApps")}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <TriggerLabel current={current} subtitle={subtitle} t={t} />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={t("switchApp")}
            side={isMobile ? "bottom" : "right"}
            className="w-72 p-0"
          >
            <Command>
              <CommandInput placeholder={t("searchApps")} />
              <CommandList>
                <CommandEmpty>{t("noAppsMatch")}</CommandEmpty>
                <CommandGroup heading={t("apps")}>
                  {(apps ?? []).map((app) => (
                    <CommandItem
                      key={app.id}
                      value={`${appLabel(app, t)} ${appMarket(app)}`}
                      onSelect={() => select(app.id)}
                    >
                      <AppIcon src={app.iconUrl} size={20} />
                      <span className="truncate">{appLabel(app, t)}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {storeLabel(app.store)}
                      </Badge>
                      <Badge variant="outline">
                        {app.country.toUpperCase()}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={t("importApp")}
                    onSelect={() => {
                      setOpen(false);
                      setImporting(true);
                    }}
                  >
                    <Plus />
                    {t("importApp")}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <ImportAppDialog
          open={importing}
          onOpenChange={setImporting}
          returnFocus={trigger}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
