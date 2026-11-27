import type { CardTheme } from "@/lib/chart-image/share-card/card-themes";

const percent = (share: number) => `${Math.round(share * 100)}%`;

const swatchBackground = ({ base, glows }: CardTheme): string =>
  [
    ...glows.map(
      ({ x, y, reach, color }) =>
        `radial-gradient(circle at ${percent(x)} ${percent(y)}, ${color} 0%, transparent ${percent(reach)})`,
    ),
    base,
  ].join(", ");

export function ThemeSwatch({ theme }: { theme: CardTheme }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-full items-center justify-center rounded-lg sm:w-16 ring-1 ring-border ring-inset group-has-checked:outline-2 group-has-checked:outline-offset-2 group-has-checked:outline-brand-mark"
      style={{ background: swatchBackground(theme) }}
    >
      <span
        className="flex h-6.5 w-11.5 items-center justify-center rounded-sm"
        style={{
          background: theme.panel,
          boxShadow: `0 0 0 1px ${theme.panelLine}`,
        }}
      >
        <svg viewBox="0 0 40 20" className="h-5 w-10">
          <path
            d="M3 16 C 12 15, 16 9, 24 9 S 33 5, 37 4"
            fill="none"
            stroke={theme.series}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}
