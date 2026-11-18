import { Button, Link, Section, Text } from 'react-email';
import { INK_LINK } from './email-theme';

interface CallToActionProps {
  href: string;
  label: string;
}

export function CallToAction({ href, label }: CallToActionProps) {
  return (
    <Section className="my-[24px]">
      <Button
        href={href}
        className="box-border rounded-[6px] bg-brand px-[20px] py-[13px] text-center text-[15px] font-semibold leading-[20px] text-brand-ink no-underline max-sm:block max-sm:w-full"
      >
        {label}
      </Button>
      <Text
        data-skip-in-text={true}
        className="mb-0 mt-[16px] text-[13px] leading-[20px] text-ink-2 dark:text-night-ink-2"
      >
        Button not working? Paste this address into your browser:{' '}
        <Link href={href} className={`break-all ${INK_LINK}`}>
          {href}
        </Link>
      </Text>
    </Section>
  );
}
