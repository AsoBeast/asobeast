import type { ReactElement } from 'react';
import { render } from 'react-email';
import { EmailLayout } from '../../mail/email-layout';
import {
  chartEntered,
  chartMilestone,
  chartMoveBatch,
} from '../chart-events.fixture';
import { buildReport } from '../report/build-report';
import type { ReportApp } from '../report/report';
import { ReportCard } from './report-card';
import { StatGrid } from './stat-grid';

const html = (element: ReactElement) =>
  render(
    <EmailLayout preview="Report" origin={null} footer={null}>
      {element}
    </EmailLayout>,
  );

const ICON = 'https://is1-ssl.mzstatic.com/image/thumb/alpha/512x512bb.jpg';

interface CardOptions extends Partial<ReportApp> {
  name?: string;
  iconUrl?: string | null;
  role?: ReportApp['identity']['role'];
}

const card = ({
  name = 'Alpha',
  iconUrl = null,
  role = 'primary',
  id = 'a',
  ...rest
}: CardOptions = {}): ReportApp => ({
  id,
  identity: { name, iconUrl, store: 'APP_STORE', country: 'us', role },
  link: { href: `https://aso.example.com/apps/${id}`, label: 'Open app' },
  groups: [],
  competitors: [],
  omittedCompetitors: 0,
  competitorsLink: null,
  ...rest,
});

describe('report components', () => {
  it('renders no stat grid without stats', async () => {
    const empty = await html(<StatGrid stats={[]} />);
    const withStat = await html(
      <StatGrid stats={[{ label: 'Rank drops', value: 3, tone: 'down' }]} />,
    );
    expect(withStat.length).toBeGreaterThan(empty.length);
    expect(empty).not.toContain('Rank drops');
  });

  it('colours a falling stat and still names it', async () => {
    const output = await html(
      <StatGrid stats={[{ label: 'Rank drops', value: 3, tone: 'down' }]} />,
    );
    expect(output).toContain('color:rgb(193,37,53)');
    expect(output).toContain('Rank drops');
  });

  it('opens a card with the app icon, its name and its storefront', async () => {
    const output = await html(<ReportCard app={card({ iconUrl: ICON })} />);

    const icon = output.match(/<img [^>]*>/)?.[0] ?? '';

    expect(icon).toContain(`src="${ICON}"`);
    expect(icon).toContain('alt=""');
    expect(icon).toContain('height="40"');
    expect(icon).toContain('width="40"');
    expect(output).toContain('href="https://aso.example.com/apps/a"');
    expect(output).toContain('>Alpha</a>');
    expect(output).toContain('App Store · US');
  });

  it('draws the chart moves group of a card with its merged row', async () => {
    const [app] = buildReport(
      chartMoveBatch(chartEntered(), chartMilestone({ from: null, to: 7 })),
      'https://aso.example.com',
    ).apps;

    const output = await html(<ReportCard app={app} />);

    expect(output).toContain('Chart moves');
    expect(output).toContain('Top free · Productivity');
    expect(output).toContain('entered the chart · entered the top 10');
  });

  it('keeps the name in place without an icon or a link', async () => {
    const output = await html(<ReportCard app={card({ link: null })} />);

    expect(output).not.toContain('<img');
    expect(output).toContain('Alpha');
    expect(output).not.toContain('href=');
  });

  it('nests a competitor and links the ones left out', async () => {
    const output = await html(
      <ReportCard
        app={card({
          competitors: [
            card({
              id: 'c',
              name: 'Charlie',
              role: 'competitor',
              iconUrl: ICON,
            }),
          ],
          omittedCompetitors: 3,
          competitorsLink: {
            href: 'https://aso.example.com/apps/a/competitors',
            label: 'See all 4 competitors',
          },
        })}
      />,
    );

    expect(output).toContain('Charlie');
    expect(output).toContain('Competitor · App Store · US');
    expect(output).toContain('Your app · App Store · US');
    expect(output).toContain('>See all 4 competitors</a>');
  });
});
