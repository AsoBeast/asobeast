import type { ChangeKind } from "./change-fields";

const SIZE = 10;

function shape(kind: ChangeKind) {
  if (kind === "text") {
    return <rect x="1" y="1" width="8" height="8" rx="1.5" />;
  }
  if (kind === "visuals") {
    return (
      <circle
        cx="5"
        cy="5"
        r="3.25"
        fill="var(--card)"
        stroke="currentColor"
        strokeWidth="2"
      />
    );
  }
  return <path d="M5 0 10 5 5 10 0 5Z" />;
}

export function KindMark({
  kind,
  own = false,
}: {
  kind: ChangeKind;
  own?: boolean;
}) {
  return (
    <svg
      aria-hidden
      width={SIZE}
      height={SIZE}
      viewBox="0 0 10 10"
      fill="currentColor"
      style={own ? { color: "var(--brand-mark)" } : undefined}
    >
      {shape(kind)}
    </svg>
  );
}
