import {
  knowsLanguage,
  languageEvidence,
  textLanguage,
  textLanguages,
} from './text-language';

describe('textLanguage', () => {
  it.each([
    ['The timer stops when the screen is locked and I lose my session', 'en'],
    ['Die App stürzt beim Start ab und ich verliere die Daten', 'de'],
    ['La aplicación se cierra cuando abro el temporizador', 'es'],
    ["L'application plante quand je lance le minuteur pour la séance", 'fr'],
    ['Aplikacja się zawiesza i nie da się jej używać na telefonie', 'pl'],
    ['Suis là depuis avant', 'fr'],
    ['Zawsze coś zamiast przycisku', 'pl'],
    ['アプリが起動しません。助けてください', 'ja'],
    ['应用程序无法启动', 'zh'],
    ['앱이 실행되지 않아요', 'ko'],
    ['Приложение не запускается после обновления', 'ru'],
    ['Застосунок не відкривається після оновлення', 'uk'],
    ['التطبيق لا يعمل بعد التحديث', 'ar'],
  ])('reads %s as %s', (text, language) => {
    expect(textLanguage(text)).toBe(language);
  });

  it('never reads a short spanish or portuguese review as english', () => {
    expect(textLanguage('no me funciona')).not.toBe('en');
    expect(textLanguage('a app não abre no meu telefone')).not.toBe('en');
  });

  it('answers nothing for text too short or too ambiguous to tell', () => {
    expect(textLanguage('Great app')).toBeNull();
    expect(textLanguage('Super!')).toBeNull();
    expect(textLanguage('')).toBeNull();
    expect(textLanguage('★★★ 123')).toBeNull();
  });

  it('keeps an english review with a japanese name english', () => {
    expect(
      textLanguage('I use this with my friend 田中 and it is the best for us'),
    ).toBe('en');
  });

  it('leaves the function words of a script language to the script check', () => {
    for (const text of [
      'Timer Planner Notes في من على',
      'Timer Planner Notes 그리고 하지만',
      'Timer Planner Notes что для это',
    ]) {
      expect(textLanguage(text)).toBeNull();
      expect(textLanguages(text)).toEqual([]);
    }
  });
});

describe('textLanguages', () => {
  it.each([
    ['La aplicación se cierra sola. Que mal servicio.', ['es', 'fr']],
    ['Basuea Como puede ser que no aregles sus bugs', ['es', 'pt']],
    ['me gusta mucho muy privado', ['es', 'fr']],
    ['No funciona. Muy mal servicio.', ['es', 'pt']],
    ['Que mal servicio', ['es', 'pt', 'fr']],
  ])(
    'answers every language tied for the most function words of %s',
    (text, languages) => {
      expect(textLanguage(text)).toBeNull();
      expect(textLanguages(text)).toEqual(languages);
    },
  );

  it('answers the one language a sure guess names', () => {
    expect(
      textLanguages('La aplicación se cierra cuando abro el temporizador'),
    ).toEqual(['es']);
    expect(
      textLanguages('Die App stürzt beim Start ab und ich verliere die Daten'),
    ).toEqual(['de']);
  });

  it('answers the language of the script', () => {
    expect(textLanguages('Приложение не запускается после обновления')).toEqual(
      ['ru'],
    );
    expect(textLanguages('アプリが起動しません。助けてください')).toEqual([
      'ja',
    ]);
  });

  it('answers nothing when no word matches or there is no letter', () => {
    expect(textLanguages('Great app')).toEqual([]);
    expect(textLanguages('Hat trick')).toEqual([]);
    expect(textLanguages('')).toEqual([]);
    expect(textLanguages('★★★ 123')).toEqual([]);
  });

  it('names the guess whenever the guess names a language', () => {
    for (const text of [
      'The timer stops when the screen is locked and I lose my session',
      "L'application plante quand je lance le minuteur pour la séance",
      'Aplikacja się zawiesza i nie da się jej używać na telefonie',
      'a app não abre no meu telefone',
    ]) {
      expect(textLanguages(text)).toEqual([textLanguage(text)]);
    }
  });
});

describe('languageEvidence', () => {
  it('counts the tokens and the function word hits of every language', () => {
    const evidence = languageEvidence(
      'The app is a timer for the gym and it works with your watch when you train at home or in the park',
    );

    expect(evidence.tokens).toBe(23);
    expect(evidence.script).toBeNull();
    expect(evidence.hits.en).toBe(14);
    expect(evidence.hits.pl).toBe(0);
  });

  it('names the script of a text written in one', () => {
    expect(languageEvidence('앱이 시작되지 않습니다').script).toBe('ko');
    expect(languageEvidence('Програма не працює після оновлення').script).toBe(
      'uk',
    );
  });

  it('answers nothing for a text without letters', () => {
    const evidence = languageEvidence('2024 1.0');

    expect(evidence.tokens).toBe(3);
    expect(evidence.script).toBeNull();
    expect(Object.values(evidence.hits).every((hits) => hits === 0)).toBe(true);
  });

  it('counts only the english words no other language shares', () => {
    const evidence = languageEvidence('Vreme in napoved in the radar');

    expect(evidence.hits.en).toBe(3);
    expect(evidence.englishOnly).toBe(1);
  });

  it('knows the languages it can name', () => {
    expect(['pl', 'en', 'ko'].map(knowsLanguage)).toEqual([true, true, true]);
    expect(['hu', 'sk', 'vi'].map(knowsLanguage)).toEqual([
      false,
      false,
      false,
    ]);
  });
});
