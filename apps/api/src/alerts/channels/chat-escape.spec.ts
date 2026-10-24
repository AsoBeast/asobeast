import { escapeDiscord, escapeSlack, slackName } from './chat-escape';

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

describe('slackName', () => {
  it('drops the markup characters slack cannot escape in a name', () => {
    expect(slackName('*Best* _Sleep_ ~App~ & Co')).toBe(
      'Best Sleep App &amp; Co',
    );
  });
});
