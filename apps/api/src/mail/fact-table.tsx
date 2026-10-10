import { Column, Row, Section } from 'react-email';

export type Fact = readonly [label: string, value: string];

export function FactTable({ facts }: { facts: readonly Fact[] }) {
  return (
    <Section className="my-[16px] rounded-[8px] bg-well px-[16px] py-[8px] dark:bg-night-well">
      {facts.map(([label, value], index) => (
        <Row key={`${label}-${index}`}>
          <Column className="w-[38%] py-[6px] pr-[12px] align-top text-[14px] leading-[20px] text-muted dark:text-night-muted">
            {label}
          </Column>
          <Column className="wrap-anywhere py-[6px] align-top text-[14px] leading-[20px] text-ink dark:text-night-ink">
            {value}
          </Column>
        </Row>
      ))}
    </Section>
  );
}
