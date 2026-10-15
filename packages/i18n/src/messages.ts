import { GROUPS } from '@chags/content';

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

    // 分组文案：id 与 groups.ts 一一对应（少了 title/note/empty 任意一个，下面就编译报错）
    'group.allusion.title': '典故',
    'group.allusion.note': '一个典故一个游戏：先听完故事，再亲手做一遍。',
    'group.allusion.empty': '这一组还在准备。',
    'group.stratagem.title': '三十六计',
    'group.stratagem.note': '三十六条计策，一条一个游戏。',
    'group.stratagem.empty': '第一批计策正在赶工，很快就能玩了。',

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

    'group.allusion.title': 'Stories',
    'group.allusion.note': 'One story, one game: hear it through, then do it yourself.',
    'group.allusion.empty': 'This group is still being prepared.',
    'group.stratagem.title': 'Thirty-Six Stratagems',
    'group.stratagem.note': 'Thirty-six stratagems, one game each.',
    'group.stratagem.empty': 'The first stratagems are being built — coming soon.',

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

export type Translator = (key: MessageKey) => string;
