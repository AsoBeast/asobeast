const words = (list: string): ReadonlySet<string> =>
  new Set(list.split(/\s+/).filter(Boolean));

type WordLists = Readonly<Record<string, ReadonlySet<string>>>;

export const CHINESE_FUNCTION_WORDS = words(`
  一个 一個 我们 我們 什么 什麼 我的 你的
`);

export const CHINESE_PARTICLES = words(`
  的 了 是 和 与 與 及 或 让 讓 你 我 他 她 都 也 就 很 把
  被 给 給 从 從 对 對 为 為
`);

export const THAI_FUNCTION_WORDS = words(`
  และ ที่ ที่สุด ของ ใน กับ หรือ ได้ ให้ เป็น มาก ทุก จาก ด้วย ไป มา นี้
  นั้น จะ ก็ แล้ว ยัง คือ โดย เพื่อ ถึง แต่ ว่า ซึ่ง อีก เลย กว่า ไม่ ต้อง
  แบบ
`);

export const ARABIC_FUNCTION_WORDS = words(`
  في من على إلى الى عن مع هذا هذه ذلك التي الذي أو او ثم كل هو هي أن ان إن
  لا ما قد بعد قبل بين حتى عند أكثر اكثر
`);

export const ARABIC_DECORATION = /\u0640|\u0670|[\u064B-\u065F]/gu;

export const ARABIC_CONJUNCTION = 'و';

const union = (...lists: readonly ReadonlySet<string>[]): ReadonlySet<string> =>
  new Set(lists.flatMap((list) => [...list]));

export const FUNCTION_WORDS: WordLists = {
  es: words(`
    de del la las el los lo al un una unos unas le les se su sus tu tus te nos
    que qué como cómo cuando cuándo donde dónde para por con sin sobre entre
    desde hasta hacia tras según durante mediante es son ser soy eres somos
    fue fueron eran está están estar estoy han hay has muy más menos pero
    sino aunque porque ni ya también tan este esta estos estas ese esa esos
    esas eso esto aquel aquella cada otro otra otros otras algo algún alguna
    algunos algunas todos toda todas cual cuál cuales quien quién quienes él
    ella ellos ellas tú usted ustedes nosotros vosotros en ha tiene había
    antes nada estaba ti
  `),
  pt: words(`
    de da do das dos em no na nos nas num numa ao aos às um uma uns umas os ou
    mas que se por para pra com sem sobre entre até desde após perante como
    quando onde ele ela eles elas você vocês nós seu sua seus suas teu tua
    nosso nossa nossos nossas este esta estes estas esse essa esses essas isto
    isso aquilo aquele aquela são foi ser estar está estão tem têm ter há
    já também muito mais menos mesmo cada todos toda todas outro outra outros
    outras pelo pela pelos pelas não só depois quem nem foram tinha havia seja
    qual será fosse dele dela deles delas lhe lhes aqueles aquelas te vos
  `),
  fr: words(`
    au aux avec ce ces cette cet dans de des du elles en et il ils je la
    le les leur leurs lui mais me moi ne nos notre nous ou par pas pour qu que
    qui sa se ses sur ta te tes toi ton tu un une vos votre vous est sont être
    ont avoir sous chez vers très aussi comme dont où si tout tous toute
    toutes chaque autre autres même quel quelle quels quelles ni ça ceci cela
    eux avant depuis suis
  `),
  de: words(`
    der die das den dem des ein eine einen einem einer eines und oder aber
    doch denn sondern nicht kein keine keinen keinem keiner ich du er sie es
    wir ihr mich dich sich uns euch ihn ihm ihnen dein deine sein seine seinen
    seinem seiner unser unsere euer ihre ihren im am auf aus bei mit nach von
    vom vor zu zum zur über unter um für gegen ohne durch bis zwischen als wie
    wenn wo was wer wen wem welche welcher welches ist sind waren wird werden
    wurde haben hatte kann können muss soll auch noch nur schon sehr mehr dann
    hier dort immer alle alles jede jeder jedes viel dir mir dies diese diesem
    diesen dieser dieses einige einmal etwas gewesen habe hatten jene jetzt
    keines manche nichts ob selbst solche sollte sonst weil weiter während
    werde wieder wollen wollte würde würden zwar damit dazu dessen derer
    andere anderen anderer anderes
  `),
  it: words(`
    il lo la gli le un una dei del dello della delle degli al allo alla alle
    agli ai dal dallo dalla dalle dai nel nello nella nelle nei negli sul
    sullo sulla sulle sui sugli di da con su per tra fra ed ma se che chi cui
    non più come anche già lui lei noi voi loro ti ci ne tuo tua tuoi tue suo
    sua suoi sue nostro nostra vostro vostra questo questa questi queste
    quello quella quelli quelle sono sei siamo siete hanno hai abbiamo
    essere avere molto tutto tutti tutta tutte ogni altro altra altri altre
    perché dove quale quanto quanti quanta quante si ha avete li nostri nostre
    vostri vostre dell nell sull dall quell
  `),
  nl: words(`
    de het een en van in op aan met voor te dat die dit deze er maar om bij
    ook tot uit door over naar niet nog wel zo dan toch al ik je jij hij ze
    zij we wij jullie ons jouw zijn haar hun uw onze is was waren bent heeft
    hebben had wordt worden kan kunnen moet zal zou wil meer veel alle alles
    geen niets iets elke andere als hem wat zich mij daar hoe want
    omdat doen toen zonder dus onder eens hier wie werd altijd doch zelf tegen
    reeds kon iemand geweest
  `),
  sv: words(`
    och det att en ett den denna detta dessa som på med för till av från om
    vid mot under över efter utan genom hos bland mellan inom åt är var vara
    har hade ha kan ska skulle vill blir blev varit inte ej eller så då
    när där här ut upp nu bara även också mycket alla allt någon något några
    varje jag du han hon vi ni de dem mig honom henne oss er din ditt dina
    sin sitt sina vår vårt våra deras hennes hans sig icke kunde vad än sedan
    ju själv hur ingen bli samma vilken sådan blivit dess sådant varför vilka
    vem vilket
  `),
  no: words(`
    og det den dette denne disse et en ett jeg du han hun vi dere de dem meg
    deg henne oss seg din ditt dine sin sitt sine vår vårt våre deres hans
    hennes til fra av på med for om ved under over etter før uten mot mellom
    hos gjennom er var vært være har hadde ha kan kunne skal skulle vil ville
    blir ble bli at som eller så da når hvor hva hvem hvordan hvorfor hvis
    hvilken ikke ingen noen noe alle mange mer mest også bare kun nå her der
    ut ned selv blitt kom meget samme hvilke hver både enn fordi slik sånn
    blei
  `),
  da: words(`
    og det den dette denne disse et en jeg du han hun vi de dem mig
    hende jer din dit dine sin sit sine vores hans hendes deres til fra af på
    med for om ved under over efter uden mellem hos gennem er var været
    være har havde have kan kunne skal skulle vil ville bliver blev blive at
    som eller så da når hvor hvad hvem hvordan hvorfor hvis ikke ingen
    nogen noget alle mange mere mest også kun nu her der ind ud ned sig jo
    anden meget nogle sådan selv
  `),
  fi: words(`
    ja että tai mutta kun jos niin kuin sekä myös vain jo vielä ei en ole on
    oli ovat olla se sen tämä tuo nämä nuo he hän minä sinä mikä joka jotka
    kuka mitä missä miten kuinka kanssa ilman kautta yli alla päälle jälkeen
    ennen mukaan koska vaikka sitten tässä siinä sinun minun meidän kaikki
    jokainen olen olet olemme olette olisi et emme ette eivät hänen te teidän
    heidän ne joten sillä vaan vai itse
  `),
  pl: words(`
    na do od po za ze przy dla bez nad przed przez między jak to że się nie
    jest są był była było być będzie oraz lub albo ale lecz czy który która
    które którzy jego jej ich twój twoja twoje nasz nasza nasze wasz wasza
    wasze swój swoja swoje ta te tego tej tym tych tylko też już jeszcze
    bardzo więcej wszystko wszyscy każdy każda każde ja ty ona my wy oni aby
    ani aż bardziej bo bowiem byli były będą choć cię czyli dlaczego gdy gdyby
    gdzie im inna inne inny innych iż jaki jakie jako jeden jedna jednak jedno
    jemu jestem jeśli jeżeli ją kiedy kto ktoś którego której których którym
    mają mam mamy mimo mnie może można musi nam nas natomiast nawet nic nich
    niego niej niemu nigdy nim nimi niż około ponieważ sobie tak taka taki
    takie także tam temu teraz wam was wiele więc wtedy właśnie żeby coś
    zamiast zawsze
  `),
  tr: words(`
    ve ile için bir bu şu da de ki mı mu mü ne ama fakat çok daha en gibi
    kadar veya ya hem her bütün tüm bazı olarak olan ise değil var yok biz siz
    onlar nasıl neden hangi
  `),
  id: words(`
    yang dan di ke dari untuk dengan pada dalam ini itu atau juga akan adalah
    oleh sebagai karena kami kita mereka dia anda kamu sudah telah belum
    tidak bukan lebih sangat semua setiap dapat bisa harus
  `),
  ro: words(`
    și şi sau de la în pe cu din pentru prin spre către un niște cel cea cei
    cele acest această acești aceste acel acea ce cum când unde că dacă
    dar însă nu mai foarte tot toate toți fi este sunt fost va vor au avea noi
    voi lui lor
  `),
  cs: words(`
    se si je jsou byl byla bylo být bude ale nebo či že jak když protože který
    která které kteří tento toto tyto on ona vy oni jeho její náš váš jejich
    při před přes mezi bez podle také jen již ještě velmi více všechno všichni
    každý na do od po za ze ve
  `),
  ru: words(`
    не что он на со как все всё она так его но да ты же вы за бы по только
    ее её мне было вот от меня еще ещё нет из ему когда даже ну ли если уже
    или ни быть был него до вас вам там потом себя ничего ей может они тут
    где надо ней для мы тебя их чем была чтоб без будто чего тоже себе под
    будет тогда кто этот того потому этого какой совсем ним здесь этом почти
    тем чтобы нее неё были куда зачем всех при об тот через эти нас всего
    них какая эту эта это этой этих этим этими такой такая такие такое им
    более между перед над после ею твой твоя твое твоё твои наш наша наше
    наши ваш ваша ваше ваши свой своя свое своё свои свою своих своей своего
    своим которая который которое которые которого которой которых которым
    которую кого кому чему чём нибудь также чей чья чьё
  `),
  uk: words(`
    на за по ніж проте та але чи або що як це цей ця ці той те ті він вона
    воно вони ми ви ти мене мені мною тебе тобі його її їх нас нам вас вам
    їм ним нею них який яка яке які якого якої яких якому яким кого кому
    чого чому де коли тут там тепер вже ще лише тільки також теж так ні не
    бути був була було були буде будуть має мають треба дуже все всі весь
    вся всього всім кожен кожна кожне кожні інший інша інше інші свій своя
    своє свої свою своїх своєї твій твоя твоє твої наш наша наше наші ваш
    ваша ваше ваші цього цієї цих цим цьому цю тієї тих тим тому якщо щоб бо
    адже навіть ось аж хоч хто хіба для без над під між через при від після
    перед до із зі
  `),
  ko: words(`
    그리고 그러나 그러면 그래서 그런데 하지만 또는 혹은 또한 이것 그것
    저것 이런 그런 저런 이렇게 그렇게 저렇게 저희 당신 여러분 각각 매우
    아주 너무 위한 위해 대한 대해 통해 통한 따라 따른 있는 있다 없는
    없다 하는 하다 한다 합니다 입니다 있습니다 없습니다 됩니다 되는 되다
    같은 같이 이미 때문 아니 아닌 않는 않고 하고 하며 하여 해서
  `),
  ar: union(
    ARABIC_FUNCTION_WORDS,
    words(`
      هذان تلك هؤلاء الذين اللذين اللاتي هم هن نحن أنا انا أنت انت أنتم انتم
      كان كانت كانوا يكون تكون يكن ليس ليست لم لن لما إذا اذا إذ إلا الا غير
      دون بدون خلال حول ضد نحو منذ لدى عندما حيث كيف لماذا متى أين اين لكن
      بل أي اي أيضا ايضا فقط كما كلما بعض هناك هنا له لها لهم لنا لك به بها
      بهم منه منها منهم فيه فيها عليه عليها إليه اليه عنه عنها معه معها
    `),
  ),
  zh: union(CHINESE_FUNCTION_WORDS, CHINESE_PARTICLES),
  th: THAI_FUNCTION_WORDS,
  ja: words(`
    です ます でした ました ません から まで より など こと もの ため
    これ それ あれ どれ この その あの ここ そこ あそこ どこ ない ある
    いる する なる できる ので のに けど でも また および ほか さん
  `),
};

export const REVIEW_ONLY_FUNCTION_WORDS: WordLists = {
  fr: words(`
    mon ma mes sans
  `),
  de: words(`
    hat war
  `),
};

export type TokenTest = (token: string) => boolean;

const listsOf = (
  source: WordLists,
  languages: readonly string[],
): ReadonlySet<string>[] =>
  languages.flatMap((language) =>
    Object.hasOwn(source, language) ? [source[language]] : [],
  );

const unconjoined = (word: string): string | null =>
  word.startsWith(ARABIC_CONJUNCTION)
    ? word.slice(ARABIC_CONJUNCTION.length)
    : null;

const containedIn =
  (lists: readonly ReadonlySet<string>[]): TokenTest =>
  (token) => {
    const word = token.replace(ARABIC_DECORATION, '');
    const joined = unconjoined(word);
    return lists.some(
      (list) => list.has(word) || (joined !== null && list.has(joined)),
    );
  };

export const functionWordTest = (languages: readonly string[]): TokenTest =>
  containedIn(listsOf(FUNCTION_WORDS, languages));

export const reviewWordTest = (languages: readonly string[]): TokenTest =>
  containedIn([
    ...listsOf(FUNCTION_WORDS, languages),
    ...listsOf(REVIEW_ONLY_FUNCTION_WORDS, languages),
  ]);
