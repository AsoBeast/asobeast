import { Link, Section, Text } from 'react-email';
import type { AlertBatchBlock } from '../alert-summary';

export interface ReportCardModel {
  title: string;
  href: string | null;
  blocks: AlertBatchBlock[];
  children: ReportCardModel[];
  notes: string[];
}

export function ReportCard({ card }: { card: ReportCardModel }) {
  return (
    <Section className="mb-[12px] rounded-[8px] border border-solid border-line p-[16px] wrap-anywhere dark:border-night-line">
      <CardBody card={card} />
    </Section>
  );
}

function NestedCard({ card }: { card: ReportCardModel }) {
  return (
    <Section className="mt-[12px] border-0 border-l-[3px] border-solid border-line pl-[12px] dark:border-night-line">
      <CardBody card={card} />
    </Section>
  );
}

function CardBody({ card }: { card: ReportCardModel }) {
  return (
    <>
      <Text className="m-0 text-[15px] font-semibold leading-[22px] text-ink dark:text-night-ink">
        {card.title}
        {card.href && (
          <>
            {' · '}
            <Link
              href={card.href}
              className="font-normal text-brand-ink underline dark:text-brand"
            >
              Open app
            </Link>
          </>
        )}
      </Text>
      {card.blocks.map((block, index) => (
        <ReportBlock key={`${block.title}-${index}`} block={block} />
      ))}
      {card.children.map((child, index) => (
        <NestedCard key={`${child.title}-${index}`} card={child} />
      ))}
      {card.notes.map((note) => (
        <ReportNote key={note}>{note}</ReportNote>
      ))}
    </>
  );
}

function ReportBlock({ block }: { block: AlertBatchBlock }) {
  return (
    <>
      {block.title && (
        <Text className="m-0 mt-[12px] text-[13px] font-semibold leading-[20px] text-ink dark:text-night-ink">
          {block.title}
        </Text>
      )}
      <ul className="m-0 mt-[4px] pl-[18px] text-[14px] leading-[22px] text-body dark:text-night-body">
        {block.lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </>
  );
}

export function ReportNote({ children }: { children: string }) {
  return (
    <Text className="m-0 mt-[8px] text-[13px] leading-[20px] text-muted dark:text-night-muted">
      {children}
    </Text>
  );
}
