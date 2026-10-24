import { escapeDiscord, escapeSlack } from './chat-escape';

describe('escapeDiscord', () => {
  it('escapes the characters discord renders as markup or mentions', () => {
    expect(escapeDiscord('_under_ *star* `code` ~x~ |s| >q @here')).toBe(
      '\\_under\\_ \\*star\\* \\`code\\` \\~x\\~ \\|s\\| \\>q \\@here',
    );
  });

  it('leaves punctuation discord shows as written', () => {
    expect(escapeDiscord('Where Am I? - GeoGuess Game (v1.2) #1 [beta]')).toBe(
      'Where Am I? - GeoGuess Game (v1.2) #1 [beta]',
    );
  });
});

describe('escapeSlack', () => {
  it('escapes the three characters slack reads as control', () => {
    expect(escapeSlack('A & <tag>')).toBe('A &amp; &lt;tag&gt;');
  });
});
