import { mergeOverlapping } from './ocr-merge';

const box = (
  text: string,
  confidence: number,
  place: { left: number; top: number; width?: number; height?: number },
) => ({ text, confidence, width: 400, height: 80, ...place });

describe('mergeOverlapping', () => {
  it('keeps the more confident read of a line both passes found', () => {
    expect(
      mergeOverlapping([
        [box('Expl0re', 71, { left: 330, top: 120 })],
        [box('Explore', 96, { left: 334, top: 118 })],
      ]),
    ).toEqual([box('Explore', 96, { left: 334, top: 118 })]);
  });

  it('keeps two lines that overlap by less than half of the smaller box', () => {
    const lines = mergeOverlapping([
      [box('Plan your week', 95, { left: 0, top: 100 })],
      [box('Tue', 90, { left: 300, top: 150, width: 200 })],
    ]);

    expect(lines.map((line) => line.text)).toEqual(['Plan your week', 'Tue']);
  });

  it('keeps two lines that only touch', () => {
    const lines = mergeOverlapping([
      [box('Plan your week', 95, { left: 0, top: 100 })],
      [box('Every day', 90, { left: 0, top: 180 })],
    ]);

    expect(lines).toHaveLength(2);
  });

  it('keeps every line of a pass when the other pass found nothing', () => {
    expect(
      mergeOverlapping([[], [box('Explore', 96, { left: 330, top: 120 })]]),
    ).toHaveLength(1);
  });
});
