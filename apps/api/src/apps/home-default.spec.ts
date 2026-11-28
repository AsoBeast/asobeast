import {
  APP_STORE_STOREFRONT_LOCALIZATIONS,
  type AppStoreLocalization,
  nativeLocalizations,
} from '@asobeast/shared';
import {
  homeDefaultCandidates,
  type LocalizationProbe,
  provenHomeDefault,
  SHARED_SCRIPT_LANGUAGES,
  suspectedHomeDefault,
  unreadHomeDefault,
} from './home-default';
import type { ConsoleListing } from './console-listing';
import { descriptionFingerprint } from './description-fingerprint';

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

const RUSSIAN_DESCRIPTION =
  'Дневник это приложение для учеников и родителей. Смотрите оценки, посещаемость и расписание уроков в одном месте. Получайте уведомления о новых оценках и сообщениях от учителей. Приложение работает со школьным журналом и доступно для каждой школы, которая пользуется системой. Все ваши данные в безопасности, а вход простой и быстрый.';

const BULGARIAN_DESCRIPTION =
  'Това приложение помага на учениците и родителите да виждат всички оценки, присъствия и разписанието на едно място. Получавате известия за нови оценки и съобщения от учителите. Приложението работи с училищния дневник и е достъпно за всяко училище, което използва системата. Всичките ви данни са в безопасност, а влизането е лесно и бързо.';

const MALAY_DESCRIPTION =
  'Aplikasi ini membantu pelajar dan ibu bapa melihat semua markah, kehadiran dan jadual waktu di satu tempat. Anda akan menerima pemberitahuan tentang markah baharu dan mesej daripada guru. Aplikasi ini berfungsi dengan daftar sekolah dan tersedia untuk setiap sekolah yang menggunakan sistem ini. Semua data anda selamat dan log masuk adalah mudah dan pantas. Anda juga boleh menambah lebih daripada satu akaun dan bertukar antara akaun pada bila-bila masa.';

const NORWEGIAN_DESCRIPTION =
  'Hva blir neste? Etter hver økt får du mer innsikt uten reklame. Noen ganger blir det bare én økt før frokost, men hver økt teller. Både nybegynnere og eksperter trener mot nye mål gjennom hele året, fordi hver dag blir litt bedre enn før. Appen har blitt brukt av mange, og hvilken økt du velger etter jobb er helt opp til deg. Ingen abonnement, bare trening slik du vil ha det, nå og senere.';

const NORWEGIAN_NEAR_DANISH_DESCRIPTION =
  'Appen er til alle som vil træne med musik. Du kan se alle dine resultater og dele dem med venner. Der er ingen reklame, og det er gratis for alle. Når du har trænet, kan du se hvor langt du er nået, og hvem der er med. Ikke mere ventetid, bare træning.';

const KOREAN_DESCRIPTION =
  '이 앱은 학생과 부모가 모든 성적, 출석, 시간표를 한곳에서 볼 수 있도록 도와줍니다. 새로운 성적과 선생님의 메시지에 대한 알림을 받을 수 있습니다. 앱은 학교 기록부와 함께 작동하며 이 시스템을 사용하는 모든 학교에서 이용할 수 있습니다. 모든 데이터는 안전하며 로그인은 간단하고 빠릅니다.';

const JAPANESE_DESCRIPTION =
  'この日記アプリは生徒と保護者のためのアプリです。成績、出席、時間割をひとつの場所で確認できます。新しい成績や先生からのメッセージの通知を受け取れます。アプリは学校の記録と連携し、このシステムを使うすべての学校で利用できます。データはすべて安全で、ログインも簡単です。';

const PORTUGUESE_DESCRIPTION =
  'O diário é um aplicativo para os alunos e os seus pais. Veja as notas, a frequência e o horário das aulas em um só lugar. Receba um aviso das novas notas e das mensagens dos professores. O aplicativo funciona com o registro da escola e está aberto a cada escola que usa o sistema. Todos os seus dados estão seguros e o acesso é simples e rápido.';

const ARABIC_DESCRIPTION =
  'هذا التطبيق يساعد الطلاب وأولياء الأمور على رؤية جميع الدرجات والحضور والجدول في مكان واحد. ستتلقى إشعارات بالدرجات الجديدة ورسائل المعلمين. يعمل التطبيق مع سجل المدرسة وهو متاح لكل مدرسة تستخدم النظام. جميع بياناتك آمنة وتسجيل الدخول سهل وسريع.';

const HINDI_DESCRIPTION =
  'यह ऐप छात्रों और माता-पिता को एक ही जगह पर सभी अंक, उपस्थिति और समय सारणी देखने में मदद करता है। आपको नए अंकों और शिक्षकों के संदेशों की सूचना मिलती है। यह ऐप स्कूल के रजिस्टर के साथ काम करता है और हर उस स्कूल के लिए उपलब्ध है जो इस प्रणाली का उपयोग करता है। आपका सारा डेटा सुरक्षित है और लॉग इन करना आसान और तेज़ है।';

const POLISH_WITH_KANA_DESCRIPTION = `${POLISH_DESCRIPTION} 日記アプリで成績と時間割を確認できます。先生からの新しいお知らせもすぐに届きます。`;

const POLISH_AND_GERMAN_DESCRIPTION = `${POLISH_DESCRIPTION} ${LONG_GERMAN_DESCRIPTION} ${GERMAN_DESCRIPTION}`;

const echoed = (...tags: AppStoreLocalization[]): LocalizationProbe[] =>
  tags.map((localization) => ({ localization, echoed: true }));

interface Proof {
  home: string;
  description: string;
  probes?: readonly LocalizationProbe[];
  declared?: readonly string[];
  consoleListing?: ConsoleListing | null;
}

const proof = ({
  home,
  description,
  probes = [],
  declared = [],
  consoleListing = null,
}: Proof) =>
  provenHomeDefault({ home, description, probes, declared, consoleListing });

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
      'proves a language the storefront does not read from the text alone',
      {
        home: 'de',
        description: POLISH_DESCRIPTION,
        probes: echoed('en-GB'),
        declared: ['PL'],
      },
      'pl',
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

describe('a language the home storefront does not read', () => {
  it.each([
    {
      label: 'polish in de declared PL',
      home: 'de',
      description: POLISH_DESCRIPTION,
      declared: ['PL'],
      expected: 'pl',
    },
    {
      label: 'polish in de declared PL, EN',
      home: 'de',
      description: POLISH_DESCRIPTION,
      declared: ['PL', 'EN'],
      expected: 'pl',
    },
    {
      label: 'polish in de declared PL, EN, DE',
      home: 'de',
      description: POLISH_DESCRIPTION,
      declared: ['PL', 'EN', 'DE'],
      expected: null,
    },
    {
      label: 'slovak in de declared CS, SK',
      home: 'de',
      description: SLOVAK_DESCRIPTION,
      declared: ['CS', 'SK'],
      expected: null,
    },
    {
      label: 'malay in de declared ID, MS',
      home: 'de',
      description: MALAY_DESCRIPTION,
      declared: ['ID', 'MS'],
      expected: null,
    },
    {
      label: 'bulgarian in de declared RU, BG',
      home: 'de',
      description: BULGARIAN_DESCRIPTION,
      declared: ['RU', 'BG'],
      expected: null,
    },
    {
      label: 'norwegian within a hit of danish in de declared NO',
      home: 'de',
      description: NORWEGIAN_NEAR_DANISH_DESCRIPTION,
      declared: ['NO'],
      expected: null,
    },
    {
      label: 'norwegian in de declared NB',
      home: 'de',
      description: NORWEGIAN_DESCRIPTION,
      declared: ['NB'],
      expected: 'no',
    },
    {
      label: 'polish in de declared EN',
      home: 'de',
      description: POLISH_DESCRIPTION,
      declared: ['EN'],
      expected: null,
    },
    {
      label: 'polish in de declared nothing',
      home: 'de',
      description: POLISH_DESCRIPTION,
      declared: [],
      expected: null,
    },
    {
      label: 'polish under twice the german in de declared PL, DE',
      home: 'de',
      description: POLISH_AND_GERMAN_DESCRIPTION,
      declared: ['PL', 'DE'],
      expected: null,
    },
    {
      label: 'russian in fr declared RU',
      home: 'fr',
      description: RUSSIAN_DESCRIPTION,
      declared: ['RU'],
      expected: 'ru',
    },
    {
      label: 'ukrainian in fr declared UK',
      home: 'fr',
      description: UKRAINIAN_DESCRIPTION,
      declared: ['UK'],
      expected: 'uk',
    },
    {
      label: 'korean in de declared KO',
      home: 'de',
      description: KOREAN_DESCRIPTION,
      declared: ['KO'],
      expected: 'ko',
    },
    {
      label: 'japanese in de declared JA',
      home: 'de',
      description: JAPANESE_DESCRIPTION,
      declared: ['JA'],
      expected: 'ja',
    },
    {
      label: 'chinese in de declared ZH',
      home: 'de',
      description: CHINESE_DESCRIPTION,
      declared: ['ZH'],
      expected: null,
    },
    {
      label: 'spanish in de declared ES',
      home: 'de',
      description: SPANISH_DESCRIPTION,
      declared: ['ES'],
      expected: null,
    },
    {
      label: 'french in de declared FR',
      home: 'de',
      description: FRENCH_DESCRIPTION,
      declared: ['FR'],
      expected: null,
    },
    {
      label: 'portuguese in de declared PT',
      home: 'de',
      description: PORTUGUESE_DESCRIPTION,
      declared: ['PT'],
      expected: null,
    },
    {
      label: 'arabic in de declared AR',
      home: 'de',
      description: ARABIC_DESCRIPTION,
      declared: ['AR'],
      expected: null,
    },
    {
      label: 'hindi in de declared HI',
      home: 'de',
      description: HINDI_DESCRIPTION,
      declared: ['HI'],
      expected: null,
    },
    {
      label: 'polish with kana in jp declared PL',
      home: 'jp',
      description: POLISH_WITH_KANA_DESCRIPTION,
      declared: ['PL'],
      expected: null,
    },
    {
      label: 'german in us declared DE',
      home: 'us',
      description: LONG_GERMAN_DESCRIPTION,
      declared: ['DE'],
      expected: 'de',
    },
    {
      label: 'catalan in es declared CA',
      home: 'es',
      description: CATALAN_DESCRIPTION,
      declared: ['CA'],
      expected: null,
    },
  ])(
    '$label answers $expected',
    ({ home, description, declared, expected }) => {
      expect(proof({ home, description, declared: [...declared] })).toBe(
        expected,
      );
    },
  );

  it('still proves polish in poland through the echo of its probe', () => {
    expect(
      proof({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        probes: echoed('pl'),
        declared: ['PL'],
      }),
    ).toBe('pl');
    expect(
      unreadHomeDefault({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        declared: ['PL'],
      }),
    ).toBeNull();
  });

  it('pins the languages whose script another app store language shares', () => {
    expect([...SHARED_SCRIPT_LANGUAGES]).toEqual(['ar', 'hi']);
  });
});

describe('the console proof', () => {
  const OTHER = 'Organise your family week, chores and rota in one place.';

  const listing = (
    matching: AppStoreLocalization[],
    primary: AppStoreLocalization | null,
    description = ENGLISH_DESCRIPTION,
    others: AppStoreLocalization[] = [],
  ): ConsoleListing => ({
    version: '1.9',
    primary,
    fingerprints: new Map([
      ...matching.map(
        (tag) => [tag, descriptionFingerprint(description)] as const,
      ),
      ...others.map((tag) => [tag, descriptionFingerprint(OTHER)] as const),
    ]),
  });

  it.each([
    [
      'names the one matching localization',
      {
        home: 'de',
        consoleListing: listing(['en-US'], 'en-US', ENGLISH_DESCRIPTION, [
          'en-GB',
        ]),
      },
      'en-US',
    ],
    [
      'wins over the listed suspect and its echo',
      {
        home: 'de',
        probes: echoed('en-GB'),
        declared: ['EN'],
        consoleListing: listing(['en-US'], 'en-US'),
      },
      'en-US',
    ],
    [
      'takes the tag the storefront reads on a tie',
      { home: 'de', consoleListing: listing(['en-US', 'en-GB'], 'en-US') },
      'en-GB',
    ],
    [
      'takes the primary on a tie the storefront does not read',
      { home: 'de', consoleListing: listing(['en-US', 'en-AU'], 'en-AU') },
      'en-AU',
    ],
    [
      'falls through on a tie without the primary',
      { home: 'de', consoleListing: listing(['en-US', 'en-AU'], 'fr-CA') },
      null,
    ],
    [
      'falls through on a tie without a primary',
      { home: 'de', consoleListing: listing(['en-US', 'en-AU'], null) },
      null,
    ],
    [
      'keeps the column null for the storefront primary',
      { home: 'de', consoleListing: listing(['de'], 'en-US') },
      null,
    ],
    [
      'falls through without a match',
      {
        home: 'de',
        consoleListing: listing([], 'en-US', ENGLISH_DESCRIPTION, ['en-US']),
      },
      null,
    ],
  ] as const)('%s', (_case, input, expected) => {
    expect(proof({ description: ENGLISH_DESCRIPTION, ...input })).toBe(
      expected,
    );
  });

  it('falls through to the public proof without a match', () => {
    expect(
      proof({
        home: 'de',
        description: ENGLISH_DESCRIPTION,
        probes: echoed('en-GB'),
        declared: ['EN'],
        consoleListing: listing([], 'en-US', ENGLISH_DESCRIPTION, ['en-US']),
      }),
    ).toBe('en-GB');
  });

  it('names a polish localization in germany and in poland', () => {
    const polish = listing(['pl'], 'pl', POLISH_DESCRIPTION);

    expect(
      proof({
        home: 'de',
        description: POLISH_DESCRIPTION,
        consoleListing: polish,
      }),
    ).toBe('pl');
    expect(
      proof({
        home: 'pl',
        description: POLISH_DESCRIPTION,
        consoleListing: polish,
      }),
    ).toBe('pl');
  });

  it('answers what the public proof answers without a console listing', () => {
    expect(
      proof({
        home: 'de',
        description: ENGLISH_DESCRIPTION,
        probes: echoed('en-GB'),
        declared: ['EN'],
      }),
    ).toBe('en-GB');
  });
});
