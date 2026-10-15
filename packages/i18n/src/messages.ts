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
    'scene.reward': '典故卡',
    'sort.tasteFirst': '先尝一口',

    'reward.keywords': '关键词',
    'reward.source': '出处',
    'reward.accept': '收下',
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
    'scene.reward': 'Story Card',
    'sort.tasteFirst': 'Taste it first',

    'reward.keywords': 'Keywords',
    'reward.source': 'Source',
    'reward.accept': 'Keep It',
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

/** "第 {n} 计"：中英句式不同，所以模板放在文案表里，数字由这里填 */
export function stratagemLabel(template: string, number: number): string {
  return template.replace('{n}', String(number));
}

export type Translator = (key: MessageKey) => string;
