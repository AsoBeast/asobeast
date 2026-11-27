import {
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  type AppStoreLocalization,
  nativeLocalizations,
} from '@asobeast/shared';
import {
  homeDefaultCandidates,
  type LocalizationProbe,
  provenHomeDefault,
  suspectedHomeDefault,
} from './home-default';

const POLISH_DESCRIPTION =
  'Dzienniczek to aplikacja dla uczniów i rodziców. Sprawdzaj oceny, frekwencję i plan lekcji w jednym miejscu. Otrzymuj powiadomienia o nowych ocenach oraz wiadomościach od nauczycieli. Aplikacja działa z dziennikiem szkolnym i jest dostępna dla każdej szkoły, która korzysta z systemu. Wszystkie dane są bezpieczne, a logowanie jest proste i szybkie. Możesz też dodać kilka kont i przełączać się między nimi bez wylogowania.';

const ENGLISH_DESCRIPTION =
  'The diary is an app for students and their parents. Check your grades, attendance and timetable in one place. Get a notice about new grades and about messages from your teachers. The app works with the school register and is open to every school that uses the system. All of your data is safe, and signing in is quick and simple. You can also add more than one account and switch between them at any time.';

const BILINGUAL_DESCRIPTION = `${POLISH_DESCRIPTION} ${ENGLISH_DESCRIPTION}`;

const HUNGARIAN_DESCRIPTION =
  'Ez az alkalmazás segít a diákoknak és a szülőknek abban, hogy minden jegyet, hiányzást és órarendet egy helyen lássanak. Értesítést kapsz az új jegyekről, valamint a tanárok üzeneteiről. Az alkalmazás az iskolai naplóval működik, és minden olyan iskola számára elérhető, amely ezt a rendszert használja. Minden adatod biztonságban van, a bejelentkezés pedig egyszerű és gyors. Több fiókot is hozzáadhatsz, és kijelentkezés nélkül válthatsz közöttük bármikor napközben vagy este otthon.';

const SLOVENIAN_DESCRIPTION =
  'Aplikacija prikazuje vremensko napoved za vse kraje v Sloveniji in opozorila pred neurjem, točo in močnim vetrom. Spremljaj radarsko sliko padavin in temperature po urah in dnevih. Prejmi obvestilo, ko se nevihta približa tvoji lokaciji, in preveri stanje na cestah. Podatki se osvežujejo vsakih deset minut in so na voljo brez registracije, zato je uporaba preprosta in hitra.';

const SLOVAK_DESCRIPTION =
  'Táto aplikácia pomáha žiakom a rodičom vidieť všetky známky, dochádzku a rozvrh hodín na jednom mieste. Dostaneš upozornenie na nové známky a na správy od učiteľov. Aplikácia funguje so školským denníkom a je dostupná pre každú školu, ktorá tento systém používa. Všetky tvoje údaje sú v bezpečí a prihlásenie je jednoduché a rýchle. Môžeš si pridať viac účtov a prepínať medzi nimi bez odhlásenia kedykoľvek počas dňa aj večer doma.';

const DUTCH_DESCRIPTION =
  'Deze app helpt leerlingen en ouders om alle cijfers, de aanwezigheid en het rooster op een plek te zien. Je krijgt een melding van nieuwe cijfers en van berichten van de leraren. De app werkt met het schoolregister en is beschikbaar voor elke school die het systeem gebruikt. Al je gegevens zijn veilig en het inloggen is eenvoudig en snel. Je kunt ook meer dan een account toevoegen en er op elk moment tussen wisselen.';

const URDU_DESCRIPTION =
  'یہ ایپ طلبہ اور والدین کو ایک ہی جگہ پر تمام نمبر، حاضری اور ٹائم ٹیبل دیکھنے میں مدد دیتی ہے۔ آپ کو نئے نمبروں اور اساتذہ کے پیغامات کی اطلاع ملتی ہے۔ یہ ایپ اسکول کے رجسٹر کے ساتھ کام کرتی ہے اور ہر اس اسکول کے لیے دستیاب ہے جو یہ نظام استعمال کرتا ہے۔ آپ کا تمام ڈیٹا محفوظ ہے اور لاگ ان کرنا آسان اور تیز ہے۔ آپ ایک سے زیادہ اکاؤنٹ شامل کر سکتے ہیں اور کسی بھی وقت ان کے درمیان بدل سکتے ہیں۔ یہ دن رات گھر پر بھی کام کرتی ہے۔';

const GERMAN_DESCRIPTION =
  'Diese App hilft Schülern und Eltern, alle Noten und den Stundenplan an einem Ort zu sehen, und sie ist für jede Schule verfügbar.';

const LONG_GERMAN_DESCRIPTION =
  'Das Tagebuch ist eine App für Schüler und ihre Eltern. Sieh dir deine Noten, die Anwesenheit und den Stundenplan an einem Ort an. Du bekommst eine Nachricht über neue Noten und über die Nachrichten von den Lehrern. Die App arbeitet mit dem Klassenbuch der Schule und ist für jede Schule offen, die das System nutzt. Alle deine Daten sind sicher, und die Anmeldung ist einfach und schnell.';

const GERMAN_AND_ENGLISH_DESCRIPTION = `${LONG_GERMAN_DESCRIPTION} ${ENGLISH_DESCRIPTION}`;

const FRENCH_DESCRIPTION =
  "Le journal est une application pour les élèves et leurs parents. Consultez vos notes, les absences et l'emploi du temps dans un seul endroit. Recevez une alerte pour les nouvelles notes et pour les messages des professeurs. L'application fonctionne avec le cahier de la classe et elle est ouverte à chaque école qui utilise le système. Toutes vos données sont en sécurité et la connexion est simple et rapide.";

const UKRAINIAN_DESCRIPTION =
  'Щоденник це програма для учнів і батьків. Переглядайте оцінки, відвідування та розклад уроків в одному місці. Отримуйте сповіщення про нові оцінки та повідомлення від вчителів. Програма працює зі шкільним журналом і доступна для кожної школи, яка користується системою. Усі ваші дані в безпеці, а вхід простий і швидкий.';

const RUSSIAN_WITH_ONE_I =
  'Дневник это приложение для учеников и родителей. Смотрите оценки, посещаемость и расписание уроков в одном месте. Получайте уведомления о новых оценках и сообщениях от учителей. Приложение работает со школьным журналом и доступно для каждой школы, которая пользуется системой. Все ваши данные в безопасности, а вход простой і быстрый.';

const SPANISH_DESCRIPTION =
  'El diario es una aplicación para los alumnos y sus padres. Consulta las notas, la asistencia y el horario de clases en un solo lugar. Recibe un aviso de las nuevas notas y de los mensajes de los profesores. La aplicación funciona con el registro de la escuela y está abierta a cada escuela que usa el sistema. Todos tus datos están seguros y el acceso es simple y rápido.';

const CHINESE_DESCRIPTION =
  '这是一款为学生和家长设计的日记应用。在一个地方查看成绩、出勤和课程表。收到新成绩和老师消息的通知。应用与学校的记录系统配合使用，每所使用该系统的学校都可以使用。所有数据都很安全，登录简单快捷。';

const CATALAN_DESCRIPTION =
  "El diari és una aplicació per als alumnes i les seves famílies. Consulta les notes, l'assistència i l'horari de classes en un sol lloc. Rep un avís de les noves notes i dels missatges dels professors. L'aplicació funciona amb el registre de l'escola i està oberta a cada escola que fa servir el sistema. Totes les teves dades estan segures i l'accés és senzill i ràpid. També pots afegir més d'un compte i canviar entre ells en qualsevol moment del dia o de la nit.";

const JAPANESE_AND_ENGLISH_DESCRIPTION = `この日記アプリで成績と時間割をひとつの場所で確認できます。先生からの新しいお知らせもすぐに届きます。 ${ENGLISH_DESCRIPTION}`;

const CHINESE_AND_ENGLISH_DESCRIPTION = `这是一款为学生和家长设计的日记应用，可以查看成绩和课程表。老师发来的新消息也会马上通知你。 ${ENGLISH_DESCRIPTION}`;

const echoed = (...tags: AppStoreLocalization[]): LocalizationProbe[] =>
  tags.map((localization) => ({ localization, echoed: true }));

interface Proof {
  home: string;
  description: string;
  probes?: LocalizationProbe[];
  declared?: string[];
}

const proof = ({ home, description, probes = [], declared = [] }: Proof) =>
  provenHomeDefault({ home, description, probes, declared });

describe('provenHomeDefault', () => {
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

  it('keeps a german listing in germany on the storefront default', () => {
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

  it('proves slovenian whose word in is also english', () => {
    expect(
      proof({
        home: 'si',
        description: SLOVENIAN_DESCRIPTION,
        probes: echoed('sl'),
        declared: ['SL'],
      }),
    ).toBe('sl');
  });

  it('never proves an unlisted native from english text', () => {
    expect(
      proof({
        home: 'si',
        description: ENGLISH_DESCRIPTION,
        probes: echoed('sl'),
        declared: ['SL'],
      }),
    ).toBeNull();
  });

  it('never proves an unlisted native from a text without letters', () => {
    expect(
      proof({
        home: 'hu',
        description: Array.from({ length: 80 }, (_, index) => `${index}`).join(
          ' ',
        ),
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

describe('provenHomeDefault in a storefront whose default is not english', () => {
  it.each<[string, Proof, AppStoreLocalization | null]>([
    [
      'proves english (u.k.) for an english listing in germany',
      {
        home: 'de',
        description: ENGLISH_DESCRIPTION,
        probes: echoed('en-GB'),
        declared: ['EN'],
      },
      'en-GB',
    ],
    [
      'proves it without declared languages',
      { home: 'de', description: ENGLISH_DESCRIPTION, probes: echoed('en-GB') },
      'en-GB',
    ],
    [
      'proves english (u.s.) for an english listing in japan',
      { home: 'jp', description: ENGLISH_DESCRIPTION, probes: echoed('en-US') },
      'en-US',
    ],
    [
      'proves english in france',
      { home: 'fr', description: ENGLISH_DESCRIPTION, probes: echoed('en-GB') },
      'en-GB',
    ],
    [
      'never proves english the store serves on its own page',
      {
        home: 'de',
        description: ENGLISH_DESCRIPTION,
        probes: [{ localization: 'en-GB', echoed: false }],
      },
      null,
    ],
    [
      'never proves english it did not probe',
      { home: 'de', description: ENGLISH_DESCRIPTION },
      null,
    ],
    [
      'keeps a german listing whose english probe echoes',
      {
        home: 'de',
        description: LONG_GERMAN_DESCRIPTION,
        probes: echoed('en-GB'),
        declared: ['DE'],
      },
      null,
    ],
    [
      'answers nothing for german and english without a clear margin',
      {
        home: 'de',
        description: GERMAN_AND_ENGLISH_DESCRIPTION,
        probes: echoed('en-GB'),
      },
      null,
    ],
    [
      'never proves english apple does not declare',
      {
        home: 'de',
        description: ENGLISH_DESCRIPTION,
        probes: echoed('en-GB'),
        declared: ['DE'],
      },
      null,
    ],
    [
      'proves french in switzerland',
      {
        home: 'ch',
        description: FRENCH_DESCRIPTION,
        probes: echoed('fr'),
        declared: ['FR'],
      },
      'fr',
    ],
    [
      'never proves ukrainian against russian',
      { home: 'ru', description: UKRAINIAN_DESCRIPTION, probes: echoed('uk') },
      null,
    ],
    [
      'never reads a russian text with one ukrainian letter as ukrainian',
      { home: 'ru', description: RUSSIAN_WITH_ONE_I, probes: echoed('uk') },
      null,
    ],
    [
      'never proves english from a japanese and english description',
      {
        home: 'jp',
        description: JAPANESE_AND_ENGLISH_DESCRIPTION,
        probes: echoed('en-US'),
      },
      null,
    ],
    [
      'never proves english from a chinese and english description',
      {
        home: 'cn',
        description: CHINESE_AND_ENGLISH_DESCRIPTION,
        probes: echoed('en-GB'),
      },
      null,
    ],
    [
      'proves english in korea',
      { home: 'kr', description: ENGLISH_DESCRIPTION, probes: echoed('en-GB') },
      'en-GB',
    ],
    [
      'proves spanish (mexico) in the united states',
      {
        home: 'us',
        description: SPANISH_DESCRIPTION,
        probes: echoed('es-MX'),
        declared: ['ES'],
      },
      'es-MX',
    ],
    [
      'answers nothing for chinese in the united states',
      {
        home: 'us',
        description: CHINESE_DESCRIPTION,
        probes: echoed('zh-Hans', 'zh-Hant'),
      },
      null,
    ],
    [
      'never proves catalan in spain',
      {
        home: 'es',
        description: CATALAN_DESCRIPTION,
        probes: echoed('ca'),
        declared: ['CA'],
      },
      null,
    ],
    [
      'never proves a language the storefront does not read',
      {
        home: 'de',
        description: POLISH_DESCRIPTION,
        probes: echoed('en-GB'),
        declared: ['PL'],
      },
      null,
    ],
    [
      'never decides on an empty description',
      { home: 'de', description: '', probes: echoed('en-GB') },
      null,
    ],
  ])('%s', (_case, input, expected) => {
    expect(proof(input)).toBe(expected);
  });
});

describe('homeDefaultCandidates', () => {
  it('reads every additional localization in another language than the default', () => {
    expect(
      ['de', 'jp', 'ch', 'es', 'ru', 'au', 'gb'].map(homeDefaultCandidates),
    ).toEqual([
      ['en-GB'],
      ['en-US'],
      ['en-GB', 'fr', 'it'],
      ['ca', 'en-GB'],
      ['en-GB', 'uk'],
      [],
      [],
    ]);
  });

  it('equals the native localizations of every storefront that defaults to english other than u.s.', () => {
    const englishDefaults = Object.entries(
      APP_STORE_STOREFRONT_LOCALIZATIONS,
    ).filter(([, { primary }]) =>
      ['en-GB', 'en-CA', 'en-AU'].includes(primary),
    );

    expect(englishDefaults.length).toBeGreaterThan(100);
    for (const [country] of englishDefaults) {
      expect(homeDefaultCandidates(country)).toEqual(
        nativeLocalizations(country),
      );
    }
  });

  it('answers nothing for a storefront the table does not list', () => {
    expect(homeDefaultCandidates('zz')).toEqual([]);
  });
});

describe('suspectedHomeDefault', () => {
  it('names english (u.k.) for an english listing in germany before any probe', () => {
    expect(
      suspectedHomeDefault({
        home: 'de',
        description: ENGLISH_DESCRIPTION,
        declared: ['EN'],
      }),
    ).toBe('en-GB');
  });

  it('names nothing for a german listing in germany', () => {
    expect(
      suspectedHomeDefault({
        home: 'de',
        description: LONG_GERMAN_DESCRIPTION,
        declared: [],
      }),
    ).toBeNull();
  });

  it('names nothing when apple leaves the language out', () => {
    expect(
      suspectedHomeDefault({
        home: 'de',
        description: ENGLISH_DESCRIPTION,
        declared: ['DE'],
      }),
    ).toBeNull();
  });

  it('names polish for a polish listing in poland', () => {
    expect(
      suspectedHomeDefault({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        declared: [],
      }),
    ).toBe('pl');
  });

  it('names nothing for an unlisted native', () => {
    expect(
      suspectedHomeDefault({
        home: 'hu',
        description: HUNGARIAN_DESCRIPTION,
        declared: ['HU'],
      }),
    ).toBeNull();
  });
});
