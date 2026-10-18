import { GROUPS, STRATAGEM_SETS } from '@chags/content';

/** 界面文案表。典故本身的文字在内容 JSON 里，不在这里。 */
export const messages = {
  'zh-CN': {
    'app.title': '中国历史典故',
    'app.subtitle': '给小朋友的典故游戏合集',
    'nav.hall': '游戏馆',
    'nav.album': '我的图鉴',
    'nav.switchTo': 'English',

    'hall.title': '游戏馆',
    'hall.collected': '已收集',
    'hall.unit': '个游戏',
    'hall.start': '开始玩',
    'hall.ages': '岁',
    'hall.soon': '敬请期待',
    'hall.myth': '神话',
    'hall.legend': '传说',
    'hall.history': '信史',
    'hall.fable': '寓言',
    'hall.strategy': '兵法',

    // 分组文案：id 与 groups.ts 一一对应（少了 title/note/empty 任意一个，下面就编译报错）
    'group.allusion.title': '典故',
    'group.allusion.note': '一个典故一个游戏：先听完故事，再亲手做一遍。',
    'group.allusion.empty': '这一组还在准备。',
    'group.stratagem.title': '三十六计',
    'group.stratagem.note': '三十六条计策，一条一个游戏。',
    'group.stratagem.empty': '三十六计都在这里了。',

    // 三十六计：卡上的"第 n 计"与六套的套名（少写一套，下面编译报错）
    'stratagem.card': '第 {n} 计',
    'stratagem.set.1': '胜战计',
    'stratagem.set.2': '敌战计',
    'stratagem.set.3': '攻战计',
    'stratagem.set.4': '混战计',
    'stratagem.set.5': '并战计',
    'stratagem.set.6': '败战计',

    'album.title': '我的图鉴',
    'album.empty': '还没有收集到图鉴卡，去游戏馆玩一局吧！',
    'album.source': '出处',

    'play.loadFailed': '这个游戏暂时打不开',
    'play.backToHall': '回游戏馆',
    'play.retry': '再试一次',
    'play.notFound': '找不到这个游戏：',

    'scene.story': '看故事',
    'story.listenFirst': '先听完这个故事',
    'scene.chaos': '开一开',
    'scene.substitution': '试一试',
    'scene.hold': '撑一撑',
    'scene.fill': '填一填',
    'scene.chase': '追一追',
    'scene.dig': '挖一挖',
    'scene.mend': '补一补',
    'scene.shoot': '射一射',
    'houyi.keepOne': '要留一个太阳',
    'scene.place': '化一化',
    'scene.taste': '尝一尝',
    'scene.dike': '筑一筑',
    'scene.guide': '疏一疏',
    'scene.wait': '等一等',
    'scene.beacon': '点一点',
    'scene.worry': '想一想',
    'scene.mark': '刻一刻',
    'scene.split': '分一分',
    'scene.burrow': '凿一凿',
    'scene.practice': '练一练',
    'scene.butcher': '游一游',
    'scene.retreat': '退一退',
    'aim.stepBack': '再退十步',
    'aim.hint': '从弓箭手往太阳那边拖一下',
    'place.hint': '拿起光球，它会告诉你该放哪儿',
    'scene.reward': '典故卡',
    'sort.tasteFirst': '先尝一口',
    // 等量代换：大象两次上秤都压垮之后的那句提示（模板层文案，不属于关卡数据）
    'substitution.tryBoat': '太重了，换个办法',

    // 到期复习：入口在图鉴，题目来自内容里的 quiz（见 docs/技术方案.md §7.4）
    'album.review': '复习',
    'album.reviewDue': '该复习了',
    'review.title': '小考验',
    'review.loading': '正在准备题目…',
    'review.notFound': '找不到这条内容',
    'review.progress': '第 {n} 题 · 共 {m} 题',
    'review.correct': '答对啦！',
    'review.wrong': '再看看答案～',
    'review.next': '继续',
    'review.seeResult': '看结果',
    'review.score': '答对 {n} / {m} 题',
    'review.nextDueIn': '{n} 天后再来复习',
    'review.backToAlbum': '回图鉴',
    'review.playAgain': '再玩一局',
    'hall.reviewDue': '有 {n} 个典故该复习了',
    'hall.reviewGo': '去复习',
    'hall.continue': '继续上次：{title}',

    'reward.transfer': '今天可以',
    'reward.keywords': '关键词',
    'reward.source': '出处',
    'reward.accept': '收下',

    'nav.soundOn': '声音：开',
    'nav.soundOff': '声音：关',
    'play.leave': '回游戏馆',
    'play.leaveConfirm': '现在回去吗？',
    'play.leaveStay': '再玩一会',
    'story.skip': '跳过故事',
    'reward.again': '再来一次',
    'reward.starsFull': '这一局一次都没点错，真稳！',
    'reward.starsWhy': '这一局有 {n} 次小失误，星星少了一点 —— 再来一次会更稳',
    'rest.title': '玩了 20 分钟啦',
    'rest.body': '让眼睛休息一下，看看远处吧',
    'rest.ok': '知道啦',
    'progress.unsaved': '这次进度可能没存上（存储空间不足？）',
    'progress.initFailed': '存档读不出来，这次从空档开始',
    'album.original': '原文',
    'parent.title': '给家长',
    'parent.enter': '长按标题 3 秒进入家长页',
    'parent.intro': '这个应用不联网、无广告、无内购、无账号，孩子的存档只保存在这台设备上。',
    'parent.noNetwork': '不联网络：全程离线可玩，不上传任何信息',
    'parent.noAds': '无广告、无内购、无抽奖、无社交与排行榜',
    'parent.archive': '存档只在本机；卸载应用或清除数据会一起删除',
    'parent.week': '本周玩了 {n} 局',
    'parent.learned': '这周复习过关的典故：',
    'parent.none': '这周还没有玩过',
    'parent.sound': '声音',
    'parent.clear': '清除本机存档',
    'parent.clearHold': '长按 3 秒清除',
    'parent.cleared': '已清除',
    'parent.version': '版本 {v}',
    'parent.back': '回游戏馆',
  },
  en: {
    'app.title': 'Chinese Tales',
    'app.subtitle': 'History and myth, played',
    'nav.hall': 'Games',
    'nav.album': 'My Album',
    'nav.switchTo': '中文',

    'hall.title': 'Games',
    'hall.collected': 'Collected',
    'hall.unit': 'games',
    'hall.start': 'Play',
    'hall.ages': 'yrs',
    'hall.soon': 'Coming soon',
    'hall.myth': 'Myth',
    'hall.legend': 'Legend',
    'hall.history': 'History',
    'hall.fable': 'Fable',
    'hall.strategy': 'Strategy',

    'group.allusion.title': 'Stories',
    'group.allusion.note': 'One story, one game: hear it through, then do it yourself.',
    'group.allusion.empty': 'This group is still being prepared.',
    'group.stratagem.title': 'Thirty-Six Stratagems',
    'group.stratagem.note': 'Thirty-six stratagems, one game each.',
    'group.stratagem.empty': 'All thirty-six stratagems are here.',

    'stratagem.card': 'Stratagem {n}',
    'stratagem.set.1': 'Advantageous Stratagems',
    'stratagem.set.2': 'Opportunistic Stratagems',
    'stratagem.set.3': 'Offensive Stratagems',
    'stratagem.set.4': 'Confusion Stratagems',
    'stratagem.set.5': 'Annexation Stratagems',
    'stratagem.set.6': 'Desperate Stratagems',

    'album.title': 'My Cards',
    'album.empty': 'No cards yet — go and play one!',
    'album.source': 'Source',

    'play.loadFailed': 'This game will not open',
    'play.backToHall': 'Back to Games',
    'play.retry': 'Try again',
    'play.notFound': 'Game not found: ',

    'scene.story': 'The Story',
    'story.listenFirst': 'Listen to the story first',
    'scene.chaos': 'Crack It',
    'scene.substitution': 'Try It',
    'scene.hold': 'Hold It Up',
    'scene.fill': 'Fill It In',
    'scene.chase': 'Chase It',
    'scene.dig': 'Dig It Out',
    'scene.mend': 'Mend the Sky',
    'scene.shoot': 'Shoot',
    'houyi.keepOne': 'Leave one sun',
    'scene.place': 'Give It Away',
    'scene.taste': 'Taste It',
    'scene.dike': 'Build It',
    'scene.guide': 'Open a Channel',
    'scene.wait': 'Wait',
    'scene.beacon': 'Light It',
    'scene.worry': 'Think It Through',
    'scene.mark': 'Mark It',
    'scene.split': 'Split It',
    'scene.burrow': 'Dig a Burrow',
    'scene.practice': 'Practise',
    'scene.butcher': 'Glide the Blade',
    'scene.retreat': 'Step Back',
    'aim.stepBack': 'Ten paces back',
    'aim.hint': 'Drag from the archer towards the sun',
    'place.hint': 'Pick up an orb — it will show you where it goes',
    'scene.reward': 'Story Card',
    'sort.tasteFirst': 'Taste it first',
    'substitution.tryBoat': 'Too heavy — try another way',

    'album.review': 'Review',
    'album.reviewDue': 'Review due',
    'review.title': 'A Quick Quiz',
    'review.loading': 'Getting the questions ready…',
    'review.notFound': 'This story is missing',
    'review.progress': 'Question {n} of {m}',
    'review.correct': 'That is right!',
    'review.wrong': 'Have another look',
    'review.next': 'Next',
    'review.seeResult': 'See how you did',
    'review.score': 'You got {n} of {m}',
    'review.nextDueIn': 'Come back in {n} days',
    'review.backToAlbum': 'Back to Cards',
    'review.playAgain': 'Play it again',
    'hall.reviewDue': '{n} stories are due for review',
    'hall.reviewGo': 'Review',
    'hall.continue': 'Continue: {title}',

    'reward.transfer': 'Try it today',
    'reward.keywords': 'Keywords',
    'reward.source': 'Source',
    'reward.accept': 'Keep It',

    'nav.soundOn': 'Sound: on',
    'nav.soundOff': 'Sound: off',
    'play.leave': 'Back to games',
    'play.leaveConfirm': 'Go back now?',
    'play.leaveStay': 'Keep playing',
    'story.skip': 'Skip the story',
    'reward.again': 'Play again',
    'reward.starsFull': 'Not a single slip — lovely!',
    'reward.starsWhy': '{n} little slips this time — one more go will be steadier',
    'rest.title': 'Twenty minutes already!',
    'rest.body': 'Let your eyes rest — look far away for a bit',
    'rest.ok': 'Got it',
    'progress.unsaved': 'This round may not be saved (storage full?)',
    'progress.initFailed': 'The save could not be read — starting fresh',
    'album.original': 'Original text',
    'parent.title': 'For parents',
    'parent.enter': 'Hold the title for 3 seconds',
    'parent.intro': 'No network, no ads, no purchases, no account. Your child\'s progress lives only on this device.',
    'parent.noNetwork': 'Fully offline: nothing is uploaded',
    'parent.noAds': 'No ads, no purchases, no lotteries, no social features or leaderboards',
    'parent.archive': 'Progress is stored only on this device; uninstalling removes it',
    'parent.week': 'Played {n} rounds this week',
    'parent.learned': 'Reviewed this week:',
    'parent.none': 'No play this week yet',
    'parent.sound': 'Sound',
    'parent.clear': 'Clear this device\'s progress',
    'parent.clearHold': 'Hold 3 seconds to clear',
    'parent.cleared': 'Cleared',
    'parent.version': 'Version {v}',
    'parent.back': 'Back to games',
  },
} as const;

export type MessageKey = keyof (typeof messages)['zh-CN'];

/** 编译期保证英文表不缺键：缺一个就类型报错 */
const englishCompleteness: Record<MessageKey, string> = messages.en;
void englishCompleteness;

/**
 * 分组文案的键。新增一个分组时，title / note / empty 少写任何一个，
 * 这里的类型就对不上，编译当场失败 —— 和英文表完整性同一个套路。
 */
type GroupField = 'title' | 'note' | 'empty';
type GroupMessageKey = `group.${(typeof GROUPS)[number]['id']}.${GroupField}`;
const groupCompleteness: Record<GroupMessageKey, string> = messages['zh-CN'];
void groupCompleteness;

/** 分组文案的键。分组 id 来自内容数据（运行时才知道是哪一组），这里做一次窄化 */
export function groupMessageKey(id: string, field: GroupField): MessageKey {
  return ('group.' + id + '.' + field) as MessageKey;
}

/**
 * 三十六计的六套套名：套号（1–6）与 groups.ts 的 STRATAGEM_SETS 是同一个约定，
 * 少写一套、或者多写一套（内容层的套数改了），messages.test.ts 会当场红。
 */
type StratagemSetIndex = 1 | 2 | 3 | 4 | 5 | 6;
type StratagemSetKey = `stratagem.set.${StratagemSetIndex}`;
const stratagemSetCompleteness: Record<StratagemSetKey, string> = messages['zh-CN'];

// 类型能挡住"少写一套"，挡不住"内容层的套数变了" —— 这一句补上：
// 改了 STRATAGEM_SETS 却忘了加/删套名，页面一进来就报错，而不是悄悄少显示一套。
// 注意：这里数的是整张表里以 stratagem.set. 开头的键（不是整张表的条数）。
const declaredSets = Object.keys(stratagemSetCompleteness).filter((key) =>
  key.startsWith('stratagem.set.'),
);
if (declaredSets.length !== STRATAGEM_SETS) {
  throw new Error(
    '三十六计套数与文案表对不上：STRATAGEM_SETS = ' + STRATAGEM_SETS +
      '，stratagem.set.* 有 ' + declaredSets.length + ' 条',
  );
}

/** 套号 → 文案键（套号来自内容数据，这里做一次窄化） */
export function stratagemSetKey(set: number): MessageKey {
  return ('stratagem.set.' + set) as MessageKey;
}

/** 文案里的占位符参数：`'review.score': '答对 {n} / {m} 题'` */
export type MessageParams = Record<string, string | number>;

/**
 * 填占位符。**只认 {名字} 形式**，缺参数时原样保留 ——
 * 少传一个参数会在界面上留下 {n}，比整句消失更容易被发现（单测会盯着这一点）。
 */
export function fillTemplate(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** "第 {n} 计"：中英句式不同，所以模板放在文案表里，数字由这里填 */
export function stratagemLabel(template: string, number: number): string {
  return fillTemplate(template, { n: number });
}

export type Translator = (key: MessageKey, params?: MessageParams) => string;
