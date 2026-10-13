/** 界面文案表。典故本身的文字在内容 JSON 里，不在这里。 */
export const messages = {
  'zh-CN': {
    'app.title': '中国历史典故',
    'app.subtitle': '给小朋友的典故游戏合集',
    'nav.hall': '典故馆',
    'nav.album': '我的图鉴',
    'nav.switchTo': 'English',

    'hall.title': '典故馆',
    'hall.collected': '已收集',
    'hall.unit': '个典故',
    'hall.start': '开始玩',
    'hall.ages': '岁',
    'hall.myth': '神话',
    'hall.history': '信史',

    'album.title': '我的典故图鉴',
    'album.empty': '还没有收集到典故卡，去典故馆玩一局吧！',
    'album.source': '出处',

    'play.notFound': '找不到这个典故：',

    'scene.story': '看故事',
    'scene.chaos': '开一开',
    'scene.substitution': '试一试',
    'scene.grow': '撑一撑',
    'scene.place': '化一化',
    'scene.reward': '典故卡',

    'reward.keywords': '关键词',
    'reward.source': '出处',
    'reward.accept': '收下',
  },
  en: {
    'app.title': 'Chinese Tales',
    'app.subtitle': 'History and myth, played',
    'nav.hall': 'Stories',
    'nav.album': 'My Album',
    'nav.switchTo': '中文',

    'hall.title': 'Story Hall',
    'hall.collected': 'Collected',
    'hall.unit': 'stories',
    'hall.start': 'Play',
    'hall.ages': 'yrs',
    'hall.myth': 'Myth',
    'hall.history': 'History',

    'album.title': 'My Story Cards',
    'album.empty': 'No cards yet — go and play one!',
    'album.source': 'Source',

    'play.notFound': 'Story not found: ',

    'scene.story': 'The Story',
    'scene.chaos': 'Crack It',
    'scene.substitution': 'Try It',
    'scene.grow': 'Hold It Up',
    'scene.place': 'Give It Away',
    'scene.reward': 'Story Card',

    'reward.keywords': 'Keywords',
    'reward.source': 'Source',
    'reward.accept': 'Keep It',
  },
} as const;

export type MessageKey = keyof (typeof messages)['zh-CN'];

/** 编译期保证英文表不缺键：缺一个就类型报错 */
const englishCompleteness: Record<MessageKey, string> = messages.en;
void englishCompleteness;

export type Translator = (key: MessageKey) => string;
