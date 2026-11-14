"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { accountPlanOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = {
  plan: "Plan",
  "daily-capacity": "Capacity",
  "getting-started": "Getting started",
  alerts: "Alerts",
  team: "Team",
  workspace: "Workspace",
} as const;

export type SettingsSectionId = keyof typeof SETTINGS_SECTIONS;

const READING_LINE = 120;

const sectionOf = (id: string) => document.getElementById(id);

function sectionAtReadingLine(
  ids: readonly SettingsSectionId[],
): SettingsSectionId | null {
  return (
    ids.findLast((id) => {
      const section = sectionOf(id);
      return section
        ? section.getBoundingClientRect().top <= READING_LINE
        : false;
    }) ?? null
  );
}

function startsInView(id: string): boolean {
  const top = sectionOf(id)?.getBoundingClientRect().top;
  return top !== undefined && top >= 0 && top < window.innerHeight;
}

function hashSection(
  ids: readonly SettingsSectionId[],
): SettingsSectionId | null {
  const hash = window.location.hash.slice(1);
  return ids.find((id) => id === hash) ?? null;
}

function useSectionInView(ids: readonly SettingsSectionId[]) {
  const [inView, setInView] = useState<SettingsSectionId | null>(null);
  const key = ids.join(" ");

  useEffect(() => {
    const known = key.split(" ") as SettingsSectionId[];
    let picked = hashSection(known);
    const read = () => {
      if (picked && !startsInView(picked)) picked = null;
      setInView(picked ?? sectionAtReadingLine(known));
    };
    const pick = () => {
      picked = hashSection(known);
      read();
    };
    read();
    window.addEventListener("scroll", read, { capture: true, passive: true });
    window.addEventListener("resize", read);
    window.addEventListener("hashchange", pick);
    return () => {
      window.removeEventListener("scroll", read, { capture: true });
      window.removeEventListener("resize", read);
      window.removeEventListener("hashchange", pick);
    };
  }, [key]);

  return inView;
}

export function SettingsIndex({
  operator,
  className,
}: {
  operator: boolean;
  className?: string;
}) {
  const { data: plan } = useQuery(accountPlanOptions);
  const ids = (Object.keys(SETTINGS_SECTIONS) as SettingsSectionId[]).filter(
    (id) =>
      (id !== "plan" || plan?.billing === true) &&
      (id !== "daily-capacity" || operator),
  );
  const inView = useSectionInView(ids) ?? ids[0];

  return (
    <nav
      aria-label="On this page"
      className={cn("sticky top-20 self-start", className)}
    >
      <p className="px-3 pb-2 text-tick text-faint-foreground">On this page</p>
      <ul className="flex flex-col gap-1">
        {ids.map((id) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={id === inView ? "location" : undefined}
              className="relative flex h-8 items-center rounded-md px-3 text-dense text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current]:bg-muted aria-[current]:font-medium aria-[current]:text-foreground aria-[current]:before:absolute aria-[current]:before:inset-y-2 aria-[current]:before:left-0 aria-[current]:before:w-0.5 aria-[current]:before:rounded-full aria-[current]:before:bg-foreground"
            >
              <span>{SETTINGS_SECTIONS[id]}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
