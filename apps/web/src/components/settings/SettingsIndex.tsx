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
};

export type SettingsSectionId = keyof typeof SETTINGS_SECTIONS;

const isSectionId = (id: string): id is SettingsSectionId =>
  Object.hasOwn(SETTINGS_SECTIONS, id);

const READING_LINE = 120;

const sectionOf = (id: string) => document.getElementById(id);

function markAt(ids: readonly SettingsSectionId[], scrolled: number) {
  const end = document.documentElement.scrollHeight - window.innerHeight;
  const shown = ids.flatMap((id) => {
    const section = sectionOf(id);
    return section
      ? [
          {
            id,
            at: section.getBoundingClientRect().top + scrolled - READING_LINE,
          },
        ]
      : [];
  });
  if (end <= 0) return shown.slice(0, 1);
  const reachable = shown.filter((mark) => mark.at <= end);
  const beyond = shown.filter((mark) => mark.at > end);
  const from = Math.max(0, reachable.at(-1)?.at ?? 0);
  return [
    ...reachable,
    ...beyond.map((mark, index) => ({
      id: mark.id,
      at: from + ((end - from) * (index + 1)) / (beyond.length + 1),
    })),
  ];
}

function sectionAtReadingLine(
  ids: readonly SettingsSectionId[],
): SettingsSectionId | null {
  const scrolled = window.scrollY;
  return (
    markAt(ids, scrolled).findLast((mark) => mark.at <= scrolled + 1)?.id ??
    null
  );
}

interface Picked {
  id: SettingsSectionId;
  anchor: Element;
}

function startsInView(anchor: Element): boolean {
  const { top } = anchor.getBoundingClientRect();
  return anchor.isConnected && top >= 0 && top < window.innerHeight;
}

function hashSection(ids: readonly SettingsSectionId[]): Picked | null {
  const anchor = sectionOf(window.location.hash.slice(1));
  const id = ids.find((known) => sectionOf(known)?.contains(anchor ?? null));
  return anchor && id ? { id, anchor } : null;
}

function useSectionInView(ids: readonly SettingsSectionId[]) {
  const [inView, setInView] = useState<SettingsSectionId | null>(null);
  const key = ids.join(" ");

  useEffect(() => {
    const known = key.split(" ").filter(isSectionId);
    let picked = hashSection(known);
    const read = () => {
      if (picked && !startsInView(picked.anchor)) picked = null;
      setInView(picked?.id ?? sectionAtReadingLine(known));
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
  const ids = Object.keys(SETTINGS_SECTIONS)
    .filter(isSectionId)
    .filter(
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
