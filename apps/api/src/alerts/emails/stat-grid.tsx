import { Column, Row, Section, Text } from 'react-email';

export interface Stat {
  label: string;
  value: number;
  tone: 'up' | 'down' | 'neutral';
}

const TONE_CLASS: Record<Stat['tone'], string> = {
  up: 'text-up dark:text-night-up',
  down: 'text-down dark:text-night-down',
  neutral: 'text-ink dark:text-night-ink',
};

const PER_ROW = 3;

export function StatGrid({ stats }: { stats: readonly Stat[] }) {
  if (stats.length === 0) {
    return null;
  }
  const rows = Array.from(
    { length: Math.ceil(stats.length / PER_ROW) },
    (_, index) => stats.slice(index * PER_ROW, (index + 1) * PER_ROW),
  );
  return (
    <Section className="my-[16px]">
      {rows.map((row) => (
        <Row key={row.map((stat) => stat.label).join()}>
          {row.map((stat) => (
            <Column
              key={stat.label}
              className="w-1/3 pb-[12px] align-top max-sm:block max-sm:w-full"
            >
              <Text
                className={`m-0 text-[24px] font-semibold leading-[32px] ${TONE_CLASS[stat.tone]}`}
              >
                {stat.value}
              </Text>
              <Text className="m-0 text-[13px] leading-[18px] text-muted dark:text-night-muted">
                {stat.label}
              </Text>
            </Column>
          ))}
        </Row>
      ))}
    </Section>
  );
}
