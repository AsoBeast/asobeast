import { type AppStoreLocalization } from '@asobeast/shared';
import { type LocalizationProbe, provenNativeDefault } from './native-default';

const POLISH_DESCRIPTION =
  'Dzienniczek to aplikacja dla uczniów i rodziców. Sprawdzaj oceny, frekwencję i plan lekcji w jednym miejscu. Otrzymuj powiadomienia o nowych ocenach oraz wiadomościach od nauczycieli. Aplikacja działa z dziennikiem szkolnym i jest dostępna dla każdej szkoły, która korzysta z systemu. Wszystkie dane są bezpieczne, a logowanie jest proste i szybkie. Możesz też dodać kilka kont i przełączać się między nimi bez wylogowania.';

const ENGLISH_DESCRIPTION =
  'The diary is an app for students and their parents. Check your grades, attendance and timetable in one place. Get a notice about new grades and about messages from your teachers. The app works with the school register and is open to every school that uses the system. All of your data is safe, and signing in is quick and simple. You can also add more than one account and switch between them at any time.';

const BILINGUAL_DESCRIPTION = `${POLISH_DESCRIPTION} ${ENGLISH_DESCRIPTION}`;

const HUNGARIAN_DESCRIPTION =
  'Ez az alkalmazás segít a diákoknak és a szülőknek abban, hogy minden jegyet, hiányzást és órarendet egy helyen lássanak. Értesítést kapsz az új jegyekről, valamint a tanárok üzeneteiről. Az alkalmazás az iskolai naplóval működik, és minden olyan iskola számára elérhető, amely ezt a rendszert használja. Minden adatod biztonságban van, a bejelentkezés pedig egyszerű és gyors. Több fiókot is hozzáadhatsz, és kijelentkezés nélkül válthatsz közöttük bármikor napközben vagy este otthon.';

const SLOVAK_DESCRIPTION =
  'Táto aplikácia pomáha žiakom a rodičom vidieť všetky známky, dochádzku a rozvrh hodín na jednom mieste. Dostaneš upozornenie na nové známky a na správy od učiteľov. Aplikácia funguje so školským denníkom a je dostupná pre každú školu, ktorá tento systém používa. Všetky tvoje údaje sú v bezpečí a prihlásenie je jednoduché a rýchle. Môžeš si pridať viac účtov a prepínať medzi nimi bez odhlásenia kedykoľvek počas dňa aj večer doma.';

const DUTCH_DESCRIPTION =
  'Deze app helpt leerlingen en ouders om alle cijfers, de aanwezigheid en het rooster op een plek te zien. Je krijgt een melding van nieuwe cijfers en van berichten van de leraren. De app werkt met het schoolregister en is beschikbaar voor elke school die het systeem gebruikt. Al je gegevens zijn veilig en het inloggen is eenvoudig en snel. Je kunt ook meer dan een account toevoegen en er op elk moment tussen wisselen.';

const URDU_DESCRIPTION =
  'یہ ایپ طلبہ اور والدین کو ایک ہی جگہ پر تمام نمبر، حاضری اور ٹائم ٹیبل دیکھنے میں مدد دیتی ہے۔ آپ کو نئے نمبروں اور اساتذہ کے پیغامات کی اطلاع ملتی ہے۔ یہ ایپ اسکول کے رجسٹر کے ساتھ کام کرتی ہے اور ہر اس اسکول کے لیے دستیاب ہے جو یہ نظام استعمال کرتا ہے۔ آپ کا تمام ڈیٹا محفوظ ہے اور لاگ ان کرنا آسان اور تیز ہے۔ آپ ایک سے زیادہ اکاؤنٹ شامل کر سکتے ہیں اور کسی بھی وقت ان کے درمیان بدل سکتے ہیں۔ یہ دن رات گھر پر بھی کام کرتی ہے۔';

const GERMAN_DESCRIPTION =
  'Diese App hilft Schülern und Eltern, alle Noten und den Stundenplan an einem Ort zu sehen, und sie ist für jede Schule verfügbar.';

const echoed = (...tags: AppStoreLocalization[]): LocalizationProbe[] =>
  tags.map((localization) => ({ localization, echoed: true }));

interface Proof {
  home: string;
  description: string;
  probes?: LocalizationProbe[];
  declared?: string[];
}

const proof = ({ home, description, probes = [], declared = [] }: Proof) =>
  provenNativeDefault({ home, description, probes, declared });

describe('provenNativeDefault', () => {
  it('proves a polish default listing in poland', () => {
    expect(
      proof({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        probes: echoed('pl'),
        declared: ['PL'],
      }),
    ).toBe('pl');
  });

  it('proves it without declared languages', () => {
    expect(
      proof({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        probes: echoed('pl'),
      }),
    ).toBe('pl');
  });

  it('keeps an english listing on the storefront default', () => {
    expect(
      proof({
        home: 'pl',
        description: ENGLISH_DESCRIPTION,
        probes: echoed('pl'),
        declared: ['EN', 'PL'],
      }),
    ).toBeNull();
  });

  it('never proves a language apple does not declare', () => {
    expect(
      proof({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        probes: echoed('pl'),
        declared: ['EN'],
      }),
    ).toBeNull();
  });

  it('never proves a native the store serves on its own page', () => {
    expect(
      proof({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        probes: [{ localization: 'pl', echoed: false }],
        declared: ['PL'],
      }),
    ).toBeNull();
  });

  it('never proves a native it did not probe', () => {
    expect(
      proof({ home: 'pl', description: POLISH_DESCRIPTION, declared: ['PL'] }),
    ).toBeNull();
  });

  it('answers nothing in a storefront whose default is not english', () => {
    expect(
      proof({ home: 'de', description: GERMAN_DESCRIPTION, declared: ['DE'] }),
    ).toBeNull();
  });

  it('answers nothing for a bilingual description without a clear margin', () => {
    expect(
      proof({
        home: 'pl',
        description: BILINGUAL_DESCRIPTION,
        probes: echoed('pl'),
        declared: ['PL'],
      }),
    ).toBeNull();
  });

  it('never decides on the title alone', () => {
    expect(
      proof({
        home: 'pl',
        description: '',
        probes: echoed('pl'),
        declared: ['PL'],
      }),
    ).toBeNull();
  });

  it('picks the native whose language wins where a storefront has two', () => {
    expect(
      proof({
        home: 'be',
        description: DUTCH_DESCRIPTION,
        probes: echoed('nl', 'fr'),
      }),
    ).toBe('nl');
  });

  it('answers nothing where two natives tie', () => {
    expect(
      proof({
        home: 'be',
        description: 'de la het de la het de la het de la het de la het',
        probes: echoed('nl', 'fr'),
      }),
    ).toBeNull();
  });

  it('reads a native from its script', () => {
    expect(
      proof({
        home: 'ua',
        description:
          'Програма допомагає учням і батькам бачити оцінки та розклад в одному місці.',
        probes: echoed('ru', 'uk'),
        declared: ['UK'],
      }),
    ).toBe('uk');
  });

  it('proves an unlisted native from a long text apple declares alone', () => {
    expect(
      proof({
        home: 'hu',
        description: HUNGARIAN_DESCRIPTION,
        probes: echoed('hu'),
        declared: ['HU'],
      }),
    ).toBe('hu');
  });

  it('needs apple to declare only the unlisted native', () => {
    expect(
      proof({
        home: 'hu',
        description: HUNGARIAN_DESCRIPTION,
        probes: echoed('hu'),
        declared: ['HU', 'EN'],
      }),
    ).toBeNull();
  });

  it('needs a long text for an unlisted native', () => {
    expect(
      proof({
        home: 'hu',
        description: HUNGARIAN_DESCRIPTION.split(' ').slice(0, 20).join(' '),
        probes: echoed('hu'),
        declared: ['HU'],
      }),
    ).toBeNull();
  });

  it('proves slovak where the czech list hits', () => {
    expect(
      proof({
        home: 'sk',
        description: SLOVAK_DESCRIPTION,
        probes: echoed('sk'),
        declared: ['SK'],
      }),
    ).toBe('sk');
  });

  it('never reads slovak as czech', () => {
    expect(
      proof({
        home: 'cz',
        description: SLOVAK_DESCRIPTION,
        probes: echoed('cs'),
        declared: ['SK'],
      }),
    ).toBeNull();
  });

  it('never proves an unlisted native from a text in a known script', () => {
    expect(
      proof({
        home: 'pk',
        description: URDU_DESCRIPTION,
        probes: echoed('ur'),
        declared: ['UR'],
      }),
    ).toBeNull();
  });
});
