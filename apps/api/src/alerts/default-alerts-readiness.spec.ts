import { essentialAlertsNeed } from './default-alerts-readiness';

describe('essentialAlertsNeed', () => {
  it.each([
    [false, 'https://aso.example.com', 'smtp'],
    [false, null, 'smtp'],
    [true, null, 'https'],
    [true, 'http://localhost:3001', 'https'],
    [true, 'https://aso.example.com', null],
  ])('answers mail %p at %p with %p', (enabled, origin, need) => {
    expect(essentialAlertsNeed(enabled, origin)).toBe(need);
  });
});
