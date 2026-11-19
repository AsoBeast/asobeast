import { STOREFRONT_LANGUAGES } from '@asobeast/shared';
import { playReleaseDate } from './google-play-release-date';
import { googlePlayLanguage } from './google-play.provider';

const RELEASED_DAY = new Date('2010-07-16T00:00:00.000Z');
const DAY_MS = 86_400_000;

const requestedLanguages = [
  ...new Set(Object.keys(STOREFRONT_LANGUAGES).map(googlePlayLanguage)),
];

const daysOf2012 = Array.from(
  { length: 366 },
  (_, index) => new Date(Date.UTC(2012, 0, 1) + index * DAY_MS),
);

describe('playReleaseDate', () => {
  it.each([
    ['en', 'Jul 16, 2010'],
    ['de', '16.07.2010'],
    ['fr', '16 juil. 2010'],
    ['es', '16 jul 2010'],
    ['it', '16 lug 2010'],
    ['pt', '16 de jul. de 2010'],
    ['nl', '16 jul 2010'],
    ['pl', '16 lip 2010'],
    ['sv', '16 juli 2010'],
    ['no', '16. juli 2010'],
    ['da', '16. jul. 2010'],
    ['fi', '16.7.2010'],
    ['ja', '2010/07/16'],
    ['ko', '2010. 7. 16.'],
    ['zh-TW', '2010年7月16日'],
    ['zh-HK', '2010年7月16日'],
    ['ru', '16 июл. 2010 г.'],
    ['tr', '16 Tem 2010'],
    ['uk', '16 лип. 2010 р.'],
    ['cs', '16. 7. 2010'],
    ['sk', '16. 7. 2010'],
    ['hu', '2010. júl. 16.'],
    ['ro', '16 iul. 2010'],
    ['el', '16 Ιουλ 2010'],
    ['he', '16 ביולי 2010'],
    ['ar', '16\u200f/07\u200f/2010'],
    ['th', '16 ก.ค. 2553'],
    ['vi', '16 thg 7, 2010'],
    ['id', '16 Jul 2010'],
    ['ms', '16 Jul 2010'],
  ])('reads the %s store date %s as its UTC day', (language, released) => {
    expect(playReleaseDate(released, language)).toEqual(RELEASED_DAY);
  });

  it.each([
    ['de', '08.07.2011', '2011-07-08'],
    ['fi', '1.11.2010', '2010-11-01'],
    ['fi', '2.11.2010', '2010-11-02'],
    ['cs', '1. 12. 2010', '2010-12-01'],
    ['sk', '1. 12. 2010', '2010-12-01'],
    ['ko', '2010. 11. 1.', '2010-11-01'],
    ['th', '26 มี.ค. 2555', '2012-03-26'],
    ['es', '15 sept 2010', '2010-09-15'],
    ['en', 'Feb 29, 2012', '2012-02-29'],
  ])(
    'reads the %s store date %s as %s and no other day',
    (language, released, day) => {
      expect(playReleaseDate(released, language)).toEqual(
        new Date(`${day}T00:00:00.000Z`),
      );
    },
  );

  it('reads an English date served to another language', () => {
    expect(playReleaseDate('Jul 16, 2010', 'de')).toEqual(RELEASED_DAY);
  });

  it.each([
    ['de', undefined],
    ['de', ''],
    ['de', 'Varies with device'],
    ['de', '31.02.2010'],
    ['de', '16.07'],
    ['de', '2010-07-16'],
    ['de', '16.07.2010 2011'],
    ['en', 'Jul 16, 20100'],
    ['en', 'Smarch 16, 2010'],
    ['en', 'Feb 29, 2011'],
    ['en', 'Jul 16, 2007'],
    ['th', '16 ก.ค. 2010'],
  ])('leaves the %s value %p unread', (language, released) => {
    expect(playReleaseDate(released, language)).toBeUndefined();
  });

  it.each(requestedLanguages)(
    'reads back every day of 2012 as Play words it in %s',
    (language) => {
      const format = new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      });
      const misread = daysOf2012.filter(
        (day) =>
          playReleaseDate(format.format(day), language)?.getTime() !==
          day.getTime(),
      );

      expect(misread).toEqual([]);
    },
  );
});
