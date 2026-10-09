const words = (list: string): ReadonlySet<string> =>
  new Set(list.split(/\s+/).filter(Boolean));

export const FUNCTION_WORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  es: words(`
    de del la las el los lo al un una unos unas le les se su sus tu tus te nos
    que qué como cómo cuando cuándo donde dónde para por con sin sobre entre
    desde hasta hacia tras según durante mediante es son ser soy eres somos
    fue fueron era eran está están estar estoy han hay has muy más menos pero
    sino aunque porque ni ya también tan este esta estos estas ese esa esos
    esas eso esto aquel aquella cada otro otra otros otras algo algún alguna
    algunos algunas todos toda todas cual cuál cuales quien quién quienes él
    ella ellos ellas tú usted ustedes nosotros vosotros en ha tiene había
    antes nada sea estaba ti
  `),
  pt: words(`
    de da do das dos em no na nos nas num numa ao aos às um uma uns umas os ou
    mas que se por para pra com sem sobre entre até desde após perante como
    quando onde ele ela eles elas você vocês nós seu sua seus suas teu tua
    nosso nossa nossos nossas este esta estes estas esse essa esses essas isto
    isso aquilo aquele aquela são foi era ser estar está estão tem têm ter há
    já também muito mais menos mesmo cada todos toda todas outro outra outros
    outras pelo pela pelos pelas não só depois quem nem foram tinha havia seja
    qual será fosse dele dela deles delas lhe lhes aqueles aquelas te vos
  `),
  fr: words(`
    au aux avec ce ces cette cet dans de des du elle elles en et il ils je la
    le les leur leurs lui mais me moi ne nos notre nous ou par pas pour qu que
    qui sa se ses sur ta te tes toi ton tu un une vos votre vous est sont être
    ont avoir sous chez vers très aussi comme dont où si tout tous toute
    toutes chaque autre autres même quel quelle quels quelles ni ça ceci cela
    eux
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
    quello quella quelli quelle sono sei siamo siete hanno hai ho abbiamo
    essere avere molto tutto tutti tutta tutte ogni altro altra altri altre
    perché dove quale quanto quanti quanta quante si ha avete li nostri nostre
    vostri vostre dell nell sull dall quell
  `),
  nl: words(`
    de het een en van in op aan met voor te dat die dit deze er maar om bij
    ook tot uit door over naar niet nog wel zo dan toch al ik je jij hij ze
    zij we wij jullie ons jouw zijn haar hun uw onze is was waren bent heeft
    hebben had wordt worden kan kunnen moet zal zou wil meer veel alle alles
    geen niets iets elke andere als hem wat men zich mij daar hoe want nu
    omdat doen toen zonder dus onder eens hier wie werd altijd doch zelf tegen
    reeds kon iemand geweest
  `),
  sv: words(`
    och det att en ett den denna detta dessa som på med för till av från om
    vid mot under över efter utan genom hos bland mellan inom åt är var vara
    har hade ha kan ska skulle vill blir blev varit inte ej men eller så då
    när där här ut upp nu bara även också mycket alla allt någon något några
    varje jag du han hon vi ni de dem mig dig honom henne oss er din ditt dina
    sin sitt sina vår vårt våra deras hennes hans sig icke kunde vad än sedan
    ju själv hur ingen bli samma vilken sådan blivit dess sådant varför vilka
    vem vilket
  `),
  no: words(`
    og det den dette denne disse et en ett jeg du han hun vi dere de dem meg
    deg ham henne oss seg din ditt dine sin sitt sine vår vårt våre deres hans
    hennes til fra av på med for om ved under over etter før uten mot mellom
    hos gjennom er var vært være har hadde ha kan kunne skal skulle vil ville
    blir ble bli at som men eller så da når hvor hva hvem hvordan hvorfor hvis
    hvilken ikke ingen noen noe alle mange mer mest også bare kun nå her der
    ut ned selv blitt kom meget samme hvilke hver både enn fordi slik sånn
    blei
  `),
  da: words(`
    og det den dette denne disse et en jeg du han hun vi de dem mig dig ham
    hende jer din dit dine sin sit sine vores hans hendes deres til fra af på
    med for om ved under over efter uden mod mellem hos gennem er var været
    være har havde have kan kunne skal skulle vil ville bliver blev blive at
    som men eller så da når hvor hvad hvem hvordan hvorfor hvis ikke ingen
    nogen noget alle mange mere mest også kun nu her der ind ud ned sig jo
    anden meget nogle sådan selv
  `),
  fi: words(`
    ja että tai mutta kun jos niin kuin sekä myös vain jo vielä ei en ole on
    oli ovat olla se sen tämä tuo nämä nuo he hän minä sinä mikä joka jotka
    kuka mitä missä miten kuinka kanssa ilman kautta yli alla päälle jälkeen
    ennen mukaan koska vaikka sitten nyt tässä siinä sinun minun meidän kaikki
    jokainen olen olet olemme olette olisi et emme ette eivät hänen te teidän
    heidän ne joten sillä vaan vai itse
  `),
  pl: words(`
    na do od po za ze przy dla bez nad przed przez między jak to że się nie
    jest są był była było być będzie oraz lub albo ale lecz czy który która
    które którzy jego jej ich twój twoja twoje nasz nasza nasze wasz wasza
    wasze swój swoja swoje ten ta te tego tej tym tych tylko też już jeszcze
    bardzo więcej wszystko wszyscy każdy każda każde ja ty ona my wy oni aby
    ani aż bardziej bo bowiem byli były będą choć cię czyli dlaczego gdy gdyby
    gdzie im inna inne inny innych iż jaki jakie jako jeden jedna jednak jedno
    jemu jestem jeśli jeżeli ją kiedy kto ktoś którego której których którym
    mają mam mamy mimo mnie może można musi nam nas natomiast nawet nic nich
    niego niej niemu nigdy nim nimi niż około ponieważ sobie tak taka taki
    takie także tam temu teraz wam was wiele więc wtedy właśnie żeby
  `),
};

export function functionWordTest(
  languages: readonly string[],
): (token: string) => boolean {
  const lists = languages.flatMap((language) =>
    Object.hasOwn(FUNCTION_WORDS, language) ? [FUNCTION_WORDS[language]] : [],
  );
  return (token) => lists.some((list) => list.has(token));
}
