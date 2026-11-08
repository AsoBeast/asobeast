import {
  NEW_TAB_LINK,
  PRIVACY_POLICY,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legal";

const LINKS = [
  { href: TERMS_OF_SERVICE_URL, label: TERMS_OF_SERVICE },
  { href: PRIVACY_POLICY_URL, label: PRIVACY_POLICY },
];

export function LegalLinks() {
  return (
    <p className="flex flex-wrap gap-x-3 text-caption text-muted-foreground">
      {LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          {...NEW_TAB_LINK}
          className="rounded-sm py-1 underline decoration-muted-foreground decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {label}
        </a>
      ))}
    </p>
  );
}
