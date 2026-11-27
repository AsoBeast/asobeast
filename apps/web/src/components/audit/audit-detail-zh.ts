type Pattern = readonly [
  RegExp,
  string | ((whole: string, ...groups: string[]) => string),
];

const quoted = (value: string): string => `“${value}”`;

const MESSAGE_ZH: Readonly<Record<string, string>> = {
  "a benefit": "优势",
  "social proof": "社会认同",
  "a feature": "功能",
  "the interface only": "仅界面",
  "something else": "其他内容",
  "an onboarding screen": "引导页",
  "nothing we could read": "无法读取的内容",
};

const messageLabel = (value: string): string => {
  const withCaption = value.match(/^(.+?) with “(.+)”$/);
  if (withCaption) {
    return `${messageLabel(withCaption[1])}，文案为“${withCaption[2]}”`;
  }
  return value.replace(
    /(a benefit|social proof|a feature|the interface only|something else|an onboarding screen|nothing we could read)/g,
    (match) => MESSAGE_ZH[match] ?? match,
  );
};

export const AUDIT_DETAIL_PATTERNS_ZH: readonly Pattern[] = [
  [
    /^The first screenshot shows (.+)\.$/,
    (whole, value) => `首张截图展示了${messageLabel(value)}。`,
  ],
  [
    /^It shows (.+)\. Most shoppers never scroll past the third screenshot\.$/,
    (whole, value) =>
      `它展示了${messageLabel(value)}。多数用户不会翻过第三张截图。`,
  ],
  [/^(\d+) declared languages\.$/, "已声明 $1 种语言。"],
  [/^(\d+) declared (?:languages|language)\.$/, "已声明 $1 种语言。"],
  [/^(\d+) iPad screenshots found\.$/, "找到 $1 张 iPad 截图。"],
  [/^(\d+) words repeat the title\.$/, "$1 个词与标题重复。"],
  [
    /^Average relevance of (\d+) keyword field entries\.$/,
    "$1 个关键词字段条目的平均相关性。",
  ],
  [
    /^Captions are in (.+); the (\w+) storefront reads (.+)\.$/,
    "截图说明语言为 $1；$2 商店市场读取 $3。",
  ],
  [
    /^The icon separates from the store background with (\S+) contrast\.$/,
    "图标与商店背景的对比度为 $1。",
  ],
  [
    /^You replied to (\d+) of (\d+) reviews at (\d) stars or less\.$/,
    "在 $2 条 $3 星及以下评论中，你已回复 $1 条。",
  ],
  [/^No competitors\.$/, "没有竞品。"],
  [/^No current creative analysis\.$/, "暂无创意素材分析。"],
  [/^No description found\.$/, "未找到描述。"],
  [/^No screenshots yet\.$/, "尚无截图。"],
  [/^None found\.$/, "未找到。"],
  [/^No ratings yet\.$/, "尚无评分。"],
  [/^No privacy policy linked\.$/, "未关联隐私政策。"],
  [/^No wasted or disallowed terms found\.$/, "未发现浪费或违规的词。"],
  [/^No claims or calls to action found\.$/, "未发现承诺或行动号召。"],
  [/^No policy or formatting issues found\.$/, "未发现商店规则或格式问题。"],
  [
    /^(\d+) policy or formatting issues found\.$/,
    "发现 $1 个商店规则或格式问题。",
  ],
  [/^No competitor icon was sent\.$/, "未收到竞品图标。"],
  [/^No competitor icon looks like yours\.$/, "没有竞品图标与你的相似。"],
  [/^No competitor titles to compare against\.$/, "没有可对比的竞品标题。"],
  [
    /^No competitors to compare positions against\.$/,
    "没有可用于对比排名的竞品。",
  ],
  [
    /^No home market keyword has competitor positions yet\.$/,
    "主市场关键词还没有竞品排名数据。",
  ],
  [
    /^No point 7 or more days before the latest\.$/,
    "没有距最新数据 7 天或更早的数据点。",
  ],
  [/^No visibility point yet\.$/, "尚无可见度数据点。"],
  [
    /^No primary keyword tracked to (?:count|look for|match)\.$/,
    "尚未跟踪可用于检查的主关键词。",
  ],
  [
    /^No primary keywords tracked to match\.$/,
    "尚未跟踪可用于匹配的主关键词。",
  ],
  [
    /^No priority keywords? (?:outside the title )?(?:to look for|tracked to check|tracked to look for)\.$/,
    "没有可检查的标题外优先关键词。",
  ],
  [/^No screenshot was analyzed\.$/, "没有截图被分析。"],
  [/^The first screenshot was not analyzed\.$/, "首张截图未被分析。"],
  [/^A nomination is submitted for featuring\.$/, "已提交精选提名。"],
  [
    /^A nomination is still a draft\. Apple asks for nominations at least two weeks ahead\.$/,
    "提名仍是草稿。Apple 要求至少提前两周提交提名。",
  ],
  [
    /^Not nominated\. Apple asks for nominations at least two weeks ahead\.$/,
    "未获提名。Apple 要求至少提前两周提交提名。",
  ],
  [
    /^Not nominated\. Apple asks for nominations at least two weeks ahead\. The window for the current version was missed until the next release\.$/,
    "未获提名。Apple 要求至少提前两周提交提名。当前版本的窗口已错过，需等下一个版本。",
  ],
  [
    /^The publish window of the submitted nomination has ended\. Apple asks for nominations at least two weeks ahead\.$/,
    "已提交提名的发布窗口已结束。Apple 要求至少提前两周提交提名。",
  ],
  [/^App Store Connect analytics only\.$/, "仅 App Store Connect 分析数据。"],
  [/^Play Console only\.$/, "仅在 Play Console 中。"],
  [/^Run and read in Play Console\.$/, "在 Play Console 中运行和查看。"],
  [
    /^Asobeast sees whether a video is linked, not what it shows\.$/i,
    "AsoBeast 只能看到视频是否关联，看不到视频内容。",
  ],
  [
    /^Happen inside your app through the In-App Review API\.$/,
    "在应用内通过应用内评论 API 完成。",
  ],
  [
    /^Happen inside your app: ask after a success moment, at most three times a year\.$/,
    "发生在你的应用内部：在成功时刻后请求评分，每年最多三次。",
  ],
  [
    /^Apple ignores keywords of two characters or fewer\.$/,
    "Apple 会忽略两个字符及以下的关键词。",
  ],
  [
    /^Apple matches singular and plural, so the stem is enough\.$/,
    "Apple 会匹配单复数，因此词干就足够。",
  ],
  [
    /^Apple has reportedly read caption text for search since June 2025, though it has not confirmed it\. /,
    "据称 Apple 自 2025 年 6 月起会读取截图文字用于搜索，但尚未确认。",
  ],
  [
    /^Google Play does not allow emoji in the title\.$/,
    "Google Play 不允许标题中使用表情符号。",
  ],
  [
    /^Google Play shoppers look for it and some categories require it\.$/,
    "Google Play 用户会搜索它，部分类别还要求填写。",
  ],
  [/^Other apps' names are not allowed\.$/, "不允许使用其他应用的名称。"],
  [
    /^Spaces after commas spend characters Apple does not index\.$/,
    "逗号后的空格会耗费字符，但 Apple 不会索引它们。",
  ],
  [
    /^Symbols such as ™ and ® spend characters Apple indexes\.$/,
    "™ 和 ® 等符号会占用 Apple 会索引的字符。",
  ],
  [
    /^Repeating a word adds nothing to search and reads as stuffing\.$/,
    "重复词语不会提升搜索效果，反而像是堆砌。",
  ],
  [
    /^Text is unreadable at the 60 point size search results use\.$/,
    "在搜索结果使用的 60 磅字号下，文字无法看清。",
  ],
  [
    /^Busy icons blur at small sizes; keep one recognizable mark\.$/,
    "元素过多的图标在小尺寸下会模糊；保留一个易于辨认的图形。",
  ],
  [
    /^Mixed palettes and layouts read as unfinished\.$/,
    "混用配色和布局会显得未完成。",
  ],
  [
    /^Shoppers comparing results could mistake one for the other\.$/,
    "用户在对比搜索结果时可能把两者混淆。",
  ],
  [
    /^It should separate from both light and dark store backgrounds\.$/,
    "图标应能同时与浅色和深色商店背景区分开。",
  ],
  [
    /^Mention ratings, downloads, awards or press you can verify\.$/,
    "可以提及你能证实的评分、下载量、奖项或媒体报道。",
  ],
  [/^Checked for a clear call to action\.$/, "已检查是否有明确的行动号召。"],
  [
    /^Checked for awards, press or user counts\.$/,
    "已检查奖项、媒体报道或用户数量。",
  ],
  [/^Checked for line breaks and bullets\.$/, "已检查换行和项目符号。"],
  [
    /^Close with one line telling the reader what to do next\.$/,
    "用一行话结尾，告诉读者下一步该做什么。",
  ],
  [
    /^Use line breaks and bullets; walls of text are skipped\.$/,
    "使用换行和项目符号；大段文字会被跳过。",
  ],
  [
    /^Pair a benefit with a priority keyword; Google Play indexes every character\.$/,
    "将一个优势与优先关键词搭配；Google Play 会索引每个字符。",
  ],
  [
    /^It is the first line shoppers read under your title and an indexed field\.$/,
    "这是用户在标题下首先读到的一行，也是被索引的字段。",
  ],
  [
    /^It is already indexed from your (subtitle|title)\.$/,
    "它已从$1中被索引。",
  ],
  [
    /^Only one priority keyword sits outside your title\. Score more keywords so the subtitle can carry two\.$/,
    "标题外只有一个优先关键词。为更多关键词评分，让副标题能承载两个。",
  ],
  [
    /^The last update was ([\d,]+) days ago\. Stores and shoppers read recency as maintenance\.$/,
    "上次更新是 $1 天前。商店和用户会把更新时效视为维护状况。",
  ],
  [
    /^The title contains (.+), a primary keyword\.$/,
    (whole, keyword) => `标题包含${quoted(keyword)}，这是一个主关键词。`,
  ],
  [
    /^The title has every word of (.+), but not the whole phrase\.$/,
    (whole, phrase) => `标题包含${quoted(phrase)}的每个词，但没有完整短语。`,
  ],
  [
    /^The title has (.+) from (.+), but not the whole phrase\.$/,
    (whole, words, phrase) => `标题包含${phrase}中的${words}，但没有完整短语。`,
  ],
  [
    /^None of your primary keywords appear in the title: (.+)\.$/,
    (whole, words) => `标题中没有出现任何主关键词：${words}。`,
  ],
  [
    /^You have ([\d,]+) ratings; the median competitor has ([\d,.]+)\.$/,
    "你有 $1 条评分；竞品中位数为 $2。",
  ],
  [
    /^You have ([\d,]+) ratings\. Add competitors to compare against your category\.$/,
    "你有 $1 条评分。添加竞品以与同类应用对比。",
  ],
  [
    /^This version averages ([\d.]+) against ([\d.]+) overall\.$/,
    "此版本平均 $1 分，整体平均 $2 分。",
  ],
  [
    /^Reviews from the last (\d+) days average ([\d.]+) across ([\d,]+)\.$/,
    "最近 $1 天的评论平均 $2 分，共 $3 条。",
  ],
  [
    /^Release notes are ([\d,]+) characters long\.$/,
    "更新说明共有 $1 个字符。",
  ],
  [
    /^Visibility fell ([\d.]+) points in (\d+) days\.$/,
    "可见度在 $2 天内下降了 $1 点。",
  ],
  [
    /^Preview videos are not measured because the audit read no product media from the store page\.$/,
    "审计未从商店页面读取产品媒体，因此不衡量预览视频。",
  ],
  [
    /^The analysis could not be queued\. Try again\.$/,
    "无法排队分析，请重试。",
  ],
  [/^The analysis did not finish\. Try again\.$/, "分析未完成，请重试。"],
  [/^Could not reach OpenAI\.$/, "无法连接 OpenAI。"],
  [/^OpenAI is rate limiting requests\.$/, "OpenAI 正在限制请求频率。"],
  [
    /^OpenAI rejected the API key\. Check OPENAI_API_KEY\.$/,
    "OpenAI 拒绝了 API 密钥。请检查 OPENAI_API_KEY。",
  ],
  [
    /^This listing has no icon or screenshots to analyze yet\. Refresh the app, then try again\.$/,
    "此详情页还没有可分析的图标或截图。请刷新应用后重试。",
  ],
  [
    /^Creative analysis runs on your own apps\.$/,
    "创意素材分析只针对你自己的应用。",
  ],
  [
    /^Your icon or screenshots changed\. Analyze them again\.$/,
    "你的图标或截图发生了变化，请重新分析。",
  ],
  [/^App Store Connect answered (\d+)\.$/, "App Store Connect 返回了 $1。"],
  [
    /^App Store Connect does not show this app to the connected key\.$/,
    "App Store Connect 未向已连接的密钥显示此应用。",
  ],
  [
    /^App Store Connect has no released iOS version for this app yet\.$/,
    "App Store Connect 中此应用尚无已发布的 iOS 版本。",
  ],
  [
    /^Not visible to Asobeast\. Up to (\d+) variants by country, audience or campaign\.$/i,
    "AsoBeast 看不到。按国家、受众或活动最多 $1 个变体。",
  ],
  [
    /^Offers and events published from Play Console are not visible to Asobeast\.$/i,
    "从 Play Console 发布的活动和优惠对 AsoBeast 不可见。",
  ],
  [
    /^Google Play shows the 1024 by 500 feature graphic at the top of the listing and in featured placements\.$/,
    "Google Play 会在详情页顶部和精选位展示 1024 x 500 的特色图片。",
  ],
  [
    /^Add a YouTube video on the listing\. Few shoppers tap play on Google Play, so do this after your screenshots\.$/,
    "在详情页添加 YouTube 视频。Google Play 上很少有人点播视频，所以请在截图之后再考虑。",
  ],
  [
    /^Upload a preview in App Store Connect\. Previews autoplay muted in search results, so lead with your best benefit\.$/,
    "在 App Store Connect 中上传预览视频。预览在搜索结果中静音自动播放，因此先展示最大优势。",
  ],
  [
    /^That is the part of the description Google Play shows before it is expanded\.$/,
    "这是 Google Play 在展开描述前显示的部分。",
  ],
  [
    /^Google Play indexes the (\d+) character short description right after the title\. Work (.+) in naturally\.$/,
    "Google Play 会紧跟标题索引 $1 个字符的简短描述。自然融入$2。",
  ],
  [
    /^Google Play does not allow claims or calls to action such as (.+) in the short description\.$/,
    "Google Play 不允许简短描述中出现$1之类的承诺或行动号召。",
  ],
  [
    /^Google Play indexes the full description\. Missing: (.+)\.$/,
    (whole, words) => `Google Play 会索引完整描述。缺少：${words}。`,
  ],
  [
    /^It appears (\d+) times in the full description\.$/,
    "它在完整描述中出现 $1 次。",
  ],
  [
    /^It appears (\d+) times; repetition beyond natural use reads as stuffing\.$/,
    "它出现 $1 次；超出自然使用的重复会被视为堆砌。",
  ],
  [
    /^It uses (\d+) characters, and App Store Connect refuses more than (\d+)\.$/,
    "它使用了 $1 个字符，而 App Store Connect 最多允许 $2 个。",
  ],
  [
    /^The subtitle is indexed right after the title\. It covers (.+) of your priority keywords; add (.+)\.$/,
    "副标题会紧跟标题被索引。它覆盖了你的$1优先关键词；请添加$2。",
  ],
  [
    /^The subtitle is the second indexed field on the App Store and it is empty\. Pair a benefit with a secondary keyword in up to (\d+) characters\.$/,
    "副标题是 App Store 的第二个被索引字段，目前为空。请在 $1 个字符内将优势与次级关键词搭配。",
  ],
  [
    /^(.+) is already in your title\. Apple indexes each word once, so the subtitle should bring new words\.$/,
    (whole, word) =>
      `${quoted(word)}已在标题中。Apple 每个词只索引一次，副标题应带来新词。`,
  ],
  [
    /^(.+) is already in your title; use the space for another keyword\.$/,
    (whole, word) => `${quoted(word)}已在标题中，请把空间留给另一个关键词。`,
  ],
  [
    /^(\d+) of (\d+) priority keywords rank in the top (\d+)\.$/,
    "$1 / $2 个优先关键词进入前 $3 名。",
  ],
  [
    /^A competitor ranks (\d+) where you rank (\d+|outside the checked depth)\. Keywords like this carry (\d+)% of your tracked keyword popularity\.$/,
    "竞品排第 $1 名，而你排$2。这类关键词占你已跟踪关键词热度的 $3%。",
  ],
  [
    /^(\d+) of your first (\d+) screenshots have no readable caption\. Put a 4 to 6 word benefit on each\.$/,
    "前 $2 张截图中有 $1 张没有可读说明。请为每张写上 4 到 6 个词的优势。",
  ],
  [
    /^Search shows the first 3 and the page holds 10\. Use at least (\d+) to cover your main benefits\.$/,
    "搜索只显示前 3 张，详情页可放 10 张。请至少使用 $1 张来展示主要优势。",
  ],
  [
    /^Google Play shows up to (\d+) per device type; (\d+) were found across device types\.$/,
    "Google Play 每种设备类型最多展示 $1 张；各设备类型共找到 $2 张。",
  ],
  [
    /^Your app runs on iPad but shows (\d+) iPad screenshots\.$/,
    "你的应用支持 iPad，但只有 $1 张 iPad 截图。",
  ],
  [
    /^The captions are in (.+), which your app does not list\.$/,
    "截图说明语言为$1，但你的应用未列出该语言。",
  ],
  [
    /^Your app supports (.+) but the captions are in (.+)\.$/,
    "你的应用支持$1，但截图说明语言为$2。",
  ],
  [/^It shows (.+)$/, (whole, value) => `它展示了${value}`],
  [
    /^At (★+) stars you convert fewer visitors than an app above ([\d.]+)\. Prompt happy users after a success moment(.*)$/,
    "在 $1 星时，你的转化率低于评分高于 $2 的应用。在成功时刻提示满意的用户评分$3。",
  ],
  [
    /^You replied to (\d+) of (\d+) reviews at (\d) stars or less\. Replies show on Google Play and reviewers can update their rating\.$/,
    "在 $2 条 $3 星及以下评论中，你已回复 $1 条。回复会显示在 Google Play 上，评论者可以更新评分。",
  ],
  [
    /^Add comma separated terms you track but do not cover yet(.*)$/,
    (whole, rest) => `添加已跟踪但尚未覆盖的词，用逗号分隔${rest}`,
  ],
  [
    /^Add (.+?) and put the words in that order so the title carries (.+) as one phrase within (\d+) characters(.*)$/,
    (whole, _words, phrase, limit, rest) =>
      `添加${_words}并调整词序，让标题在 ${limit} 个字符内将${quoted(phrase)}作为完整短语${rest}`,
  ],
  [
    /^Put (.+) in your title$/,
    (whole, phrase) => `将${quoted(phrase)}放入标题`,
  ],
  [
    /^Add (.+) to your (short description|title|subtitle|description)$/,
    (whole, phrase, field) =>
      `将${phrase}添加到${field === "short description" ? "简短描述" : field === "title" ? "标题" : field === "subtitle" ? "副标题" : "描述"}`,
  ],
  [
    /^Cut your keyword field to (\d+) characters$/,
    "将关键词字段精简到 $1 个字符",
  ],
  [
    /^Rate your keyword field entries for relevance and replace the weakest ones\.$/,
    "评估关键词字段中各条目的相关性，替换最弱的条目。",
  ],
  [
    /^Swap low relevance keywords out of your field$/,
    "替换关键词字段中相关性低的词",
  ],
  [/^Find out why this version rates lower$/, "排查此版本评分下降的原因"],
  [/^Grow your rating count$/, "增加评分数量"],
  [/^Raise your icon's contrast$/, "提高图标对比度"],
  [/^Remove text from your icon$/, "移除图标中的文字"],
  [/^Simplify your icon to one or two elements$/, "将图标简化为一到两个元素"],
  [/^Give your screenshots one visual style$/, "让截图采用统一视觉风格"],
  [/^Add iPad screenshots$/, "添加 iPad 截图"],
  [
    /^Add readable captions to your first screenshots$/,
    "为首张截图添加可读说明",
  ],
  [
    /^Write your captions in a language your app supports$/,
    "用应用支持的语言撰写截图说明",
  ],
  [/^Use your keywords in screenshot captions$/, "在截图说明中使用关键词"],
  [/^Link a privacy policy$/, "关联隐私政策"],
  [/^Localize your listing for more markets$/, "为更多市场本地化详情页"],
  [/^Add social proof to your description$/, "在描述中加入社会认同"],
  [/^Break your description into short sections$/, "把描述拆成短段落"],
  [/^Open your description with the benefit$/, "在描述开头突出优势"],
  [/^End your description with a call to action$/, "在描述结尾加入行动号召"],
  [/^Say what changed in your release notes$/, "在更新说明中写明改动"],
  [/^Address what recent reviewers report$/, "回应近期评论者反馈的问题"],
  [/^Reply to negative reviews$/, "回复低分评论"],
  [
    /^Cover more priority keywords in your subtitle$/,
    "在副标题中覆盖更多优先关键词",
  ],
  [/^Write a short description$/, "撰写简短描述"],
  [/^Add competitors to compare titles$/, "添加竞品以对比标题"],
  [/^Add competitors to compare icons$/, "添加竞品以对比图标"],
  [/^Add competitors to find keyword gaps$/, "添加竞品以发现关键词缺口"],
  [
    /^Track keywords in your home market to compare positions$/,
    "在主市场跟踪关键词以对比排名",
  ],
  [
    /^Score your tracked keywords to find your primary keywords$/,
    "为已跟踪关键词评分，找出主关键词",
  ],
  [/^Needs (\d+) days? of position history$/, "需要 $1 天排名历史"],
  [/^Positions appear after the first daily check$/, "首次每日检查后显示排名"],
];
