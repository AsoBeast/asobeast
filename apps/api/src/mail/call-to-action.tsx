import { Button, Link, Section, Text } from 'react-email';

interface CallToActionProps {
  href: string;
  label: string;
}

export function CallToAction({ href, label }: CallToActionProps) {
  return (
    <Section className="my-[24px]">
      <Button
        href={href}
        className="box-border rounded-[8px] bg-brand px-[24px] py-[14px] text-center text-[16px] font-semibold leading-[20px] text-ink no-underline max-sm:block max-sm:w-full"
      >
        {label}
      </Button>
      <Text
        data-skip-in-text={true}
        className="mb-0 mt-[16px] text-[14px] leading-[22px] text-muted dark:text-night-muted"
      >
        Button not working? Paste this address into your browser:{' '}
        <Link
          href={href}
          className="break-all text-brand-ink underline dark:text-brand"
        >
          {href}
        </Link>
      </Text>
    </Section>
  );
}
