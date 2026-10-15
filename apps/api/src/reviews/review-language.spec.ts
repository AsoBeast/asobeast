import { reviewLanguage } from './review-language';

describe('reviewLanguage', () => {
  it.each([
    ['The timer stops when the screen is locked and I lose my session', 'en'],
    ['Die App stürzt beim Start ab und ich verliere die Daten', 'de'],
    ['La aplicación se cierra cuando abro el temporizador', 'es'],
    ["L'application plante quand je lance le minuteur pour la séance", 'fr'],
    ['Aplikacja się zawiesza i nie da się jej używać na telefonie', 'pl'],
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
