import { describe, expect, it } from 'vitest';

import {
  isStopword,
  normalizeText,
  searchKey,
  STOPWORDS,
  tokenize,
} from './text';

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('Habit Tracker')).toBe('habit tracker');
  });

  it('lowercases a capital dotted I to one letter', () => {
    expect(normalizeText('İstanbul')).toBe('istanbul');
    expect(normalizeText('İZMİRA')).toBe('izmira');
    expect(normalizeText('Kayıt İzmir')).toBe('kayıt izmir');
  });

  it('lowercases a dotted I written with a combining dot to one letter', () => {
    expect(normalizeText('I\u0307stanbul')).toBe('istanbul');
    expect(normalizeText('I\u0307ZMI\u0307R')).toBe('izmir');
    expect(normalizeText('i\u0307stanbul')).toBe('istanbul');
  });

  it('keeps the dotless i and accented letters as they are', () => {
    expect(normalizeText('ILIK ılık')).toBe('ilik ılık');
    expect(normalizeText('Café Crème')).toBe('café crème');
  });

  it('normalizes decomposed input the same as precomposed input', () => {
    const composed = 'Zażółć Café';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed);
    expect(normalizeText(decomposed)).toBe('zażółć café');
    expect(normalizeText(decomposed)).toBe(normalizeText(composed));
  });

  it('keeps combining marks that have no precomposed form inside the word', () => {
    expect(normalizeText('हिंदी मौसम')).toBe('हिंदी मौसम');
    expect(normalizeText('مُحَمَّد')).toBe('مُحَمَّد');
    expect(normalizeText('\u0958a')).toBe('\u0915\u093ca');
  });

  it('drops combining marks that follow no letter or number', () => {
    expect(normalizeText(' \u0301 ')).toBe('');
    expect(normalizeText('\u0301habit, \u0308tracker')).toBe('habit tracker');
  });

  it('keeps every letter joined to the letter after it', () => {
    const split: string[] = [];
    for (let codePoint = 0; codePoint <= 0x10ffff; codePoint += 1) {
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
      const letter = String.fromCodePoint(codePoint);
      if (/\p{L}/u.test(letter) && normalizeText(`${letter}a`).includes(' ')) {
        split.push(letter);
      }
    }
    expect(split).toEqual([]);
  });

  it('strips punctuation and emoji', () => {
    expect(normalizeText('Streak🔥 Counter, Daily!')).toBe(
      'streak counter daily',
    );
  });

  it('collapses whitespace', () => {
    expect(normalizeText('  water   drink  ')).toBe('water drink');
  });

  it('returns empty string for pure noise', () => {
    expect(normalizeText('!!! 🔥 ---')).toBe('');
  });
});

describe('tokenize', () => {
  it('splits normalized text into tokens', () => {
    expect(tokenize('PDF Scanner & Document')).toEqual([
      'pdf',
      'scanner',
      'document',
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('stopwords', () => {
  it('flags common English words', () => {
    expect(isStopword('the')).toBe(true);
    expect(isStopword('with')).toBe(true);
  });

  it('flags store noise words', () => {
    expect(isStopword('app')).toBe(true);
    expect(isStopword('free')).toBe(true);
    expect(isStopword('best')).toBe(true);
    expect(isStopword('new')).toBe(true);
    expect(isStopword('official')).toBe(true);
  });

  it('does not flag meaningful terms', () => {
    expect(isStopword('tracker')).toBe(false);
    expect(isStopword('game')).toBe(false);
  });

  it('has a substantial list', () => {
    expect(STOPWORDS.size).toBeGreaterThanOrEqual(120);
  });
});

describe('searchKey', () => {
  it('folds case, punctuation, whitespace and diacritics', () => {
    expect(searchKey('Géo  Quiz!')).toBe('geo quiz');
    expect(searchKey('Block Blast！')).toBe('block blast');
    expect(searchKey('  ÀÉÎÕÜ  ')).toBe('aeiou');
  });

  it('keeps scripts whose marks are letters intact', () => {
    expect(searchKey('地理クイズ')).toBe('地理クイズ');
    expect(searchKey('खेल')).toBe('खेल');
    expect(searchKey('खेल')).not.toBe(searchKey('खल'));
    expect(searchKey('เกม')).toBe('เกม');
    expect(searchKey('')).toBe('');
  });

  it('folds greek accents like latin ones', () => {
    expect(searchKey('Γεωγραφία')).toBe('γεωγραφια');
  });

  it('leaves normalizeText unchanged', () => {
    expect(normalizeText('Géo  Quiz!')).toBe('géo quiz');
  });
});
