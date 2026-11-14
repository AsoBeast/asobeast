export function GuideLink({
  href,
  subject,
  children,
}: {
  href: string;
  subject: string;
  children: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex w-fit items-center rounded-sm text-foreground link-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span>{children}</span>
      <span className="sr-only">{` for ${subject}`}</span>
    </a>
  );
}
