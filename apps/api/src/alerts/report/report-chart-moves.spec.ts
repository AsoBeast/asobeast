import {
  chartEntered,
  chartLeft,
  chartMilestone,
  productivityChart,
} from '../chart-events.fixture';
import {
  chartLabel,
  chartMoveRows,
  chartMoveTone,
  mergeChartMoves,
} from './report-chart-moves';

const reachedTop10 = chartMilestone({ from: null, to: 7 });
const lostTop10 = chartMilestone({ direction: 'left', from: 7, to: null });

describe('chartMoveRows', () => {
  it('merges the entry and the milestone of one chart and day into one row', () => {
    expect(chartMoveRows([reachedTop10, chartEntered()])).toEqual([
      {
        kind: 'move',
        label: 'Top free · Productivity',
        from: '>100',
        to: '#7',
        note: 'entered the chart · entered the top 10',
      },
    ]);
  });

  it('notes a milestone inside the chart alone', () => {
    expect(chartMoveRows([chartMilestone()])).toEqual([
      {
        kind: 'move',
        label: 'Top free · Productivity',
        from: '#14',
        to: '#8',
        note: 'entered the top 10',
      },
    ]);
  });

  it('merges an exit with the milestone it lost', () => {
    expect(chartMoveRows([chartLeft(), lostTop10])).toEqual([
      expect.objectContaining({
        from: '#7',
        to: '>100',
        note: 'left the chart · left the top 10',
      }),
    ]);
  });

  it('notes an entry alone', () => {
    expect(chartMoveRows([chartEntered()])[0].note).toBe('entered the chart');
  });

  it('keeps one row per chart in the order the moves arrived', () => {
    const grossing = chartEntered({
      chart: { ...productivityChart, collection: 'grossing' },
    });

    expect(
      chartMoveRows([grossing, chartEntered()]).map((row) =>
        row.kind === 'move' ? row.label : null,
      ),
    ).toEqual(['Top grossing · Productivity', 'Top free · Productivity']);
  });

  it('keeps one row per day of the same chart', () => {
    expect(
      chartMoveRows([chartEntered(), chartLeft({ date: '2026-07-23' })]),
    ).toHaveLength(2);
  });

  it('prints a miss at the depth of a Google Play chart', () => {
    const play = chartLeft({
      chart: {
        store: 'GOOGLE_PLAY',
        country: 'de',
        collection: 'free',
        genre: 'GAME_PUZZLE',
        genreName: 'Puzzle',
        device: 'android',
      },
      depth: 200,
    });

    expect(chartMoveRows([play])).toEqual([
      expect.objectContaining({
        label: 'Top free · Puzzle',
        from: '#7',
        to: '>200',
      }),
    ]);
  });
});

describe('mergeChartMoves', () => {
  it('counts one entry per chart and day', () => {
    expect(mergeChartMoves([chartEntered(), reachedTop10])).toHaveLength(1);
    expect(mergeChartMoves([])).toEqual([]);
  });
});

describe('chartMoveTone', () => {
  it('reads gains up, losses down and a mix neutral', () => {
    expect(chartMoveTone([chartEntered(), reachedTop10])).toBe('up');
    expect(chartMoveTone([chartLeft(), lostTop10])).toBe('down');
    expect(chartMoveTone([chartEntered(), chartLeft()])).toBe('neutral');
  });
});

describe('chartLabel', () => {
  it('names the chart kind, the category and the storefront', () => {
    expect(
      chartLabel({
        ...productivityChart,
        country: 'de',
        collection: 'grossing',
        genre: 'overall',
        genreName: 'Overall',
      }),
    ).toBe('Top grossing · Overall (DE)');
  });
});
