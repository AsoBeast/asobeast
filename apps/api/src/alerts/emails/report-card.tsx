import type { ReactNode } from 'react';
import { Column, Img, Link, Row, Section, Text } from 'react-email';
import type { ReportApp, ReportGroup } from '../report/report';
import { rowText } from '../report/report-blocks';
import { identityLine } from '../report/storefront';

const ICON_SIZE = 40;

export function CardHeader({ app }: { app: ReportApp }) {
  const subtitle = identityLine(app, false);
  const { name, iconUrl } = app.identity;
  return (
    <Row>
      <Column className="w-[52px] align-top">
        {iconUrl && (
          <Img
            src={iconUrl}
            alt=""
            width={ICON_SIZE}
            height={ICON_SIZE}
            className="rounded-[8px]"
          />
        )}
      </Column>
      <Column className="align-top">
        <Text className="m-0 text-[15px] font-semibold leading-[22px] text-ink dark:text-night-ink">
          {app.link ? (
            <Link
              href={app.link.href}
              className="text-ink underline dark:text-night-ink"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </Text>
        {subtitle && (
          <Text className="m-0 text-[13px] leading-[18px] text-muted dark:text-night-muted">
            {subtitle}
          </Text>
        )}
      </Column>
    </Row>
  );
}

export function ReportNote({ children }: { children: ReactNode }) {
  return (
    <Text className="m-0 mt-[8px] text-[13px] leading-[20px] text-muted dark:text-night-muted">
      {children}
    </Text>
  );
}

function GroupNote({ group }: { group: ReportGroup }) {
  const hidden = group.total - group.rows.length;
  if (hidden <= 0) return null;
  return (
    <ReportNote>
      {group.link ? (
        <Link
          href={group.link.href}
          className="text-brand-ink underline dark:text-brand"
        >
          {group.link.label}
        </Link>
      ) : (
        `+${hidden} more`
      )}
    </ReportNote>
  );
}

function ReportGroupBlock({ group }: { group: ReportGroup }) {
  return (
    <>
      <Text className="m-0 mt-[12px] text-[13px] font-semibold leading-[20px] text-ink dark:text-night-ink">
        {group.title}
      </Text>
      <ul className="m-0 mt-[4px] pl-[18px] text-[14px] leading-[22px] text-body dark:text-night-body">
        {group.rows.map(rowText).map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <GroupNote group={group} />
    </>
  );
}

function CompetitorsNote({ app }: { app: ReportApp }) {
  if (app.omittedCompetitors <= 0) return null;
  return (
    <ReportNote>
      {app.competitorsLink ? (
        <Link
          href={app.competitorsLink.href}
          className="text-brand-ink underline dark:text-brand"
        >
          {app.competitorsLink.label}
        </Link>
      ) : (
        `+${app.omittedCompetitors} more competitor${app.omittedCompetitors === 1 ? '' : 's'}`
      )}
    </ReportNote>
  );
}

function CardBody({ app }: { app: ReportApp }) {
  return (
    <>
      <CardHeader app={app} />
      {app.groups.map((group) => (
        <ReportGroupBlock key={group.kind} group={group} />
      ))}
      {app.competitors.map((competitor) => (
        <Section
          key={competitor.id}
          className="mt-[12px] border-0 border-l-[3px] border-solid border-line pl-[12px] dark:border-night-line"
        >
          <CardBody app={competitor} />
        </Section>
      ))}
      <CompetitorsNote app={app} />
    </>
  );
}

export function ReportCard({ app }: { app: ReportApp }) {
  return (
    <Section className="mb-[12px] rounded-[8px] border border-solid border-line p-[16px] wrap-anywhere dark:border-night-line">
      <CardBody app={app} />
    </Section>
  );
}
