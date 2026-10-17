import { reviewLanguage, reviewLanguages } from './review-language';

describe('reviewLanguage', () => {
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
    expect(reviewLanguage(text)).toBe(language);
  });

  it('never reads a short spanish or portuguese review as english', () => {
    expect(reviewLanguage('no me funciona')).not.toBe('en');
    expect(reviewLanguage('a app não abre no meu telefone')).not.toBe('en');
  });

  it('answers nothing for text too short or too ambiguous to tell', () => {
    expect(reviewLanguage('Great app')).toBeNull();
    expect(reviewLanguage('Super!')).toBeNull();
    expect(reviewLanguage('')).toBeNull();
    expect(reviewLanguage('★★★ 123')).toBeNull();
  });

  it('keeps an english review with a japanese name english', () => {
    expect(
      reviewLanguage(
        'I use this with my friend 田中 and it is the best for us',
      ),
    ).toBe('en');
  });
});

describe('reviewLanguages', () => {
  it.each([
    ['La aplicación se cierra sola. Que mal servicio.', ['es', 'fr']],
    ['Basuea Como puede ser que no aregles sus bugs', ['es', 'pt']],
    ['me gusta mucho muy privado', ['es', 'fr']],
    ['No funciona. Muy mal servicio.', ['es', 'pt']],
    ['Que mal servicio', ['es', 'pt', 'fr']],
  ])(
    'answers every language tied for the most function words of %s',
    (text, languages) => {
      expect(reviewLanguage(text)).toBeNull();
      expect(reviewLanguages(text)).toEqual(languages);
    },
  );

  it('answers the one language a sure guess names', () => {
    expect(
      reviewLanguages('La aplicación se cierra cuando abro el temporizador'),
    ).toEqual(['es']);
    expect(
      reviewLanguages(
        'Die App stürzt beim Start ab und ich verliere die Daten',
      ),
    ).toEqual(['de']);
  });

  it('answers the language of the script', () => {
    expect(
      reviewLanguages('Приложение не запускается после обновления'),
    ).toEqual(['ru']);
    expect(reviewLanguages('アプリが起動しません。助けてください')).toEqual([
      'ja',
    ]);
  });

  it('answers nothing when no word matches or there is no letter', () => {
    expect(reviewLanguages('Great app')).toEqual([]);
    expect(reviewLanguages('Hat trick')).toEqual([]);
    expect(reviewLanguages('')).toEqual([]);
    expect(reviewLanguages('★★★ 123')).toEqual([]);
  });

  it('names the guess whenever the guess names a language', () => {
    for (const text of [
      'The timer stops when the screen is locked and I lose my session',
      "L'application plante quand je lance le minuteur pour la séance",
      'Aplikacja się zawiesza i nie da się jej używać na telefonie',
      'a app não abre no meu telefone',
    ]) {
      expect(reviewLanguages(text)).toEqual([reviewLanguage(text)]);
    }
  });
});
