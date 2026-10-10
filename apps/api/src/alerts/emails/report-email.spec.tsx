import type { ReactElement } from 'react';
import { render } from 'react-email';
import { EmailLayout } from '../../mail/email-layout';
import { ReportCard } from './report-card';
import { StatGrid } from './stat-grid';

const html = (element: ReactElement) =>
  render(
    <EmailLayout preview="Report" origin={null} footer={null}>
      {element}
    </EmailLayout>,
  );

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

  it('renders a nested card with its title and lines', async () => {
    const output = await html(
      <ReportCard
        card={{
          title: 'Primary app · Alpha',
          href: null,
          blocks: [],
          children: [
            {
              title: 'Competitor · Charlie',
              href: null,
              blocks: [{ title: '', lines: ['subtitle: a → b'] }],
              children: [],
              notes: [],
            },
          ],
          notes: ['+1 more competitor'],
        }}
      />,
    );
    expect(output).toContain('Competitor · Charlie');
    expect(output).toContain('<li>subtitle: a → b</li>');
    expect(output).toContain('+1 more competitor');
    expect(output).not.toContain('Open app');
  });
});
