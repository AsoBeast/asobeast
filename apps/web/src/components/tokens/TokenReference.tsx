"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { contrastRatio } from "@/lib/contrast";
import { PrimitiveGallery } from "./PrimitiveGallery";
import { TypeScale } from "./TypeScale";
import {
  ACCENT_RAMP,
  CHART_SERIES,
  NEUTRAL_RAMP,
  RANK_BANDS,
  RESERVED_SIGNALS,
  SEMANTIC_SURFACES,
  SIDEBAR_TOKENS,
  TEXT_PAIRS,
} from "./token-groups";

const ELEVATIONS = ["flat", "raised", "overlay"] as const;
const RADII = ["sm", "md", "lg", "xl", "2xl"] as const;

const ALL_TOKENS = Array.from(
  new Set([
    ...NEUTRAL_RAMP,
    ...ACCENT_RAMP,
    ...SEMANTIC_SURFACES,
    ...RESERVED_SIGNALS,
    ...RANK_BANDS,
    ...CHART_SERIES,
    ...SIDEBAR_TOKENS,
  ]),
);

type Resolved = Record<string, string>;

const EMPTY: Resolved = {};

function readTokens(): Resolved {
  const computed = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    ALL_TOKENS.map((token) => [
      token,
      computed.getPropertyValue(token).trim() || "—",
    ]),
  );
}

function useResolvedTokens(): Resolved {
  const [values, setValues] = useState<Resolved>(EMPTY);

  useEffect(() => {
    const measure = () => setValues(readTokens());
    const frame = requestAnimationFrame(measure);
    const observer = new MutationObserver(measure);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return values;
}

function SwatchGrid({
  title,
  tokens,
  values,
}: {
  title: string;
  tokens: string[];
  values: Resolved;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tokens.map((token) => (
          <div key={token} className="flex flex-col gap-1">
            <div
              className="h-12 rounded-md border border-border"
              style={{ background: `var(${token})` }}
            />
            <code className="text-[11px] text-muted-foreground">{token}</code>
            <code className="text-[10px] break-all text-muted-foreground/70">
              {values[token] ?? "—"}
            </code>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContrastTable({ values }: { values: Resolved }) {
  return (
    <section aria-label="Measured contrast" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Measured contrast</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Every reserved token pair with its measured contrast ratio against
            the required floor.
          </caption>
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 font-medium">
                Pair
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Ratio
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Floor
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {TEXT_PAIRS.map((pair) => {
              const ratio = contrastRatio(
                values[pair.foreground] ?? "",
                values[pair.background] ?? "",
              );
              const passing = ratio !== null && ratio >= pair.floor;
              return (
                <tr key={pair.label}>
                  <td className="py-1.5">{pair.label}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {ratio === null ? "—" : `${ratio.toFixed(2)}:1`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {pair.floor}
                  </td>
                  <td
                    className={`py-1.5 text-right font-medium ${
                      passing ? "text-signal-up" : "text-signal-down"
                    }`}
                  >
                    {ratio === null ? "unreadable" : passing ? "pass" : "fail"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Elevations() {
  return (
    <section aria-label="Elevation" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Elevation</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ELEVATIONS.map((level) => (
          <div
            key={level}
            className="rounded-lg bg-card p-6 text-sm"
            style={{ boxShadow: `var(--elevation-${level})` }}
          >
            {level}
          </div>
        ))}
      </div>
    </section>
  );
}

function Radii() {
  return (
    <section aria-label="Radius" className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Radius</h2>
      <div className="flex flex-wrap gap-4">
        {RADII.map((step) => (
          <div key={step} className="flex flex-col items-center gap-1">
            <div
              className="size-16 bg-secondary"
              style={{ borderRadius: `var(--radius-${step})` }}
            />
            <code className="text-[11px] text-muted-foreground">{step}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TokenReference() {
  const values = useResolvedTokens();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Design tokens
          </h1>
          <p className="text-sm text-muted-foreground">
            Development only. Every value is read from the live cascade, so this
            page cannot drift from the stylesheet.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          Switch theme
        </Button>
      </header>

      <SwatchGrid title="Neutral ramp" tokens={NEUTRAL_RAMP} values={values} />
      <SwatchGrid title="Accent ramp" tokens={ACCENT_RAMP} values={values} />
      <SwatchGrid
        title="Semantic surfaces"
        tokens={SEMANTIC_SURFACES}
        values={values}
      />
      <SwatchGrid
        title="Reserved signals"
        tokens={RESERVED_SIGNALS}
        values={values}
      />
      <SwatchGrid title="Rank bands" tokens={RANK_BANDS} values={values} />
      <SwatchGrid title="Chart series" tokens={CHART_SERIES} values={values} />
      <SwatchGrid title="Sidebar" tokens={SIDEBAR_TOKENS} values={values} />
      <TypeScale />
      <PrimitiveGallery />
      <Elevations />
      <Radii />
      <ContrastTable values={values} />
    </div>
  );
}
