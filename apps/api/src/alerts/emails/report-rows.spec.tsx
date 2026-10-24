import { render } from 'react-email';
import type { ReportRow } from '../report/report';
import { ReportRowView } from './report-rows';

const html = (row: ReportRow) => render(<ReportRowView row={row} />);

describe('ReportRowView', () => {
  it('draws a rank move as the keyword, the move and its note', async () => {
    const output = await html({
      kind: 'move',
      label: 'habit tracker',
      from: '#14',
      to: '#8',
      note: 'entered the top 10',
    });

    expect(output.match(/<td/g)).toHaveLength(3);
    expect(output).toContain('>habit tracker<');
    expect(output).toContain('>#14 → #8<');
    expect(output).toContain('>entered the top 10<');
  });

  it('draws an icon change as both icons around an arrow', async () => {
    const output = await html({
      kind: 'image',
      field: 'Icon changed',
      beforeUrl: 'https://x.test/old.png',
      afterUrl: 'https://x.test/new.png',
    });

    expect(output).toContain('>Icon changed<');
    expect(output).toMatch(
      /<img[^>]*alt="Previous icon"[^>]*src="https:\/\/x\.test\/old\.png"/,
    );
    expect(output).toMatch(
      /<img[^>]*alt="New icon"[^>]*src="https:\/\/x\.test\/new\.png"/,
    );
    expect(output).toContain('>→<');
  });

  it('names an icon an app did not have before', async () => {
    const output = await html({
      kind: 'image',
      field: 'Icon changed',
      beforeUrl: null,
      afterUrl: 'https://x.test/new.png',
    });

    expect(output).toContain('>none<');
    expect(output.match(/<img/g)).toHaveLength(1);
  });

  it('draws a field change with its label in medium weight', async () => {
    const output = await html({
      kind: 'change',
      field: "What's new",
      before: '"Bug fixes."',
      after: '"Faster sync"',
    });

    expect(output).toMatch(/<span class="font-medium">What&#x27;s new<\/span>/);
    expect(output).toContain(
      ': &quot;Bug fixes.&quot; → &quot;Faster sync&quot;',
    );
  });

  it('draws a text row and its detail', async () => {
    const output = await html({
      kind: 'text',
      text: 'High · Fix a weak audit factor · impact 40',
      detail: 'US · App Store · subtitle scored 3/10',
    });

    expect(output).toContain('>High · Fix a weak audit factor · impact 40<');
    expect(output).toContain('>US · App Store · subtitle scored 3/10<');
  });
});
