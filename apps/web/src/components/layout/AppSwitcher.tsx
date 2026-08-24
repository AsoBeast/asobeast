"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
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

function appLabel(app: AppListItem): string {
  return app.name ?? "Untitled app";
}

function appMarket(app: AppListItem): string {
  return `${storeLabel(app.store)} · ${app.country.toUpperCase()}`;
}

function TriggerLabel({
  current,
  total,
}: {
  current: AppListItem | undefined;
  total: number;
}) {
  return (
    <>
      {current ? (
        <AppIcon src={current.iconUrl} name={current.name} size={24} />
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
          {current ? appLabel(current) : "All apps"}
        </span>
        <span className="truncate text-caption text-sidebar-foreground/70">
          {current ? appMarket(current) : `${total} tracked`}
        </span>
      </span>
      <ChevronsUpDown className="ml-auto" />
    </>
  );
}

function ImportEntry() {
  const [importing, setImporting] = useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="Import app"
          onClick={() => setImporting(true)}
        >
          <Plus />
          <span className="font-medium">Import app</span>
        </SidebarMenuButton>
        <ImportAppDialog open={importing} onOpenChange={setImporting} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { data: apps, isPending } = useQuery(appsOptions);

  const route = appRouteFrom(pathname);
  const current = route ? apps?.find((app) => app.id === route.id) : undefined;

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
              size="lg"
              aria-label={
                current
                  ? `Switch app, currently ${appLabel(current)}`
                  : "Choose an app"
              }
              tooltip={current ? appLabel(current) : "All apps"}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <TriggerLabel current={current} total={apps?.length ?? 0} />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            className="w-72 p-0"
          >
            <Command>
              <CommandInput placeholder="Search apps…" />
              <CommandList>
                <CommandEmpty>No apps match.</CommandEmpty>
                <CommandGroup heading="Apps">
                  {(apps ?? []).map((app) => (
                    <CommandItem
                      key={app.id}
                      value={`${appLabel(app)} ${appMarket(app)}`}
                      onSelect={() => select(app.id)}
                    >
                      <AppIcon src={app.iconUrl} name={app.name} size={20} />
                      <span className="truncate">{appLabel(app)}</span>
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
                    value="import app"
                    onSelect={() => {
                      setOpen(false);
                      setImporting(true);
                    }}
                  >
                    <Plus />
                    Import app
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <ImportAppDialog open={importing} onOpenChange={setImporting} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
