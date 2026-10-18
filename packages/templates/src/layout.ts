import type { GameContext } from '@chags/game-kit';

/** 设计分辨率与所有可交互元素的坐标。e2e 直接复用这些常量。 */
export const DESIGN = { width: 750, height: 1334 } as const;

export const SCENE_KEYS = {
  story: 'story',
  chaos: 'chaos',
  substitution: 'substitution',
  tap: 'tap',
  place: 'place',
  aim: 'aim',
  sort: 'sort',
  trace: 'trace',
  wait: 'wait',
  beacon: 'beacon',
  mark: 'mark',
  split: 'split',
  burrow: 'burrow',
  butcher: 'butcher',
  ruse: 'ruse',
  siege: 'siege',
  borrow: 'borrow',
  stillness: 'stillness',
  window: 'window',
  show: 'show',
  twoline: 'twoline',
  read: 'read',
  matchup: 'matchup',
  probe: 'probe',
  lure: 'lure',
  chase: 'chase',
  swap: 'swap',
  chain: 'chain',
  reward: 'reward',
} as const;

/**
 * 场景收尾的默认值 —— 每个游戏都要传、而且传的都是同一份的两个参数：
 * - `reveal` 默认讲这一条内容的"关键抉择"揭晓语（ctx.content.keyMoment.reveal）；
 * - `nextSceneKey` 默认回典故卡（SCENE_KEYS.reward）；中间幕显式传下一幕的键。
 *
 * 以前 53 个 games/index.ts 每个都手抄这两行；默认值收到模板里之后，
 * 它们只在"不是默认"时才需要写（例如 dayu 的 tap → trace）。
 */
export function resolveEnding<T extends { reveal?: string; nextSceneKey?: string }>(
  ctx: GameContext,
  cfg: T,
): { reveal: string; nextSceneKey: string } {
  return {
    reveal: cfg.reveal ?? ctx.content.keyMoment.reveal,
    nextSceneKey: cfg.nextSceneKey ?? SCENE_KEYS.reward,
  };
}

// ---------- 分幕绘本 ----------
export const STORY_ART = { x: 55, y: 300, w: 640, h: 620 } as const;
export const STORY_TITLE_Y = 205;
/** 正文起始 y：往下留出小手的位置（英文更长的句子也不会被挡住） */
export const STORY_TEXT_Y = 950;
/** 正文换行宽度：44px 汉字一行 13 个字 —— 560 会排成 12/12/12/2，末行只剩标点 */
export const STORY_TEXT_WRAP = 596;

// ---------- 等量代换场景 ----------
export const SUB = {
  /** 水面高度 */
  waterTop: 620,
  waterBottom: 1080,
  /** 近岸沙滩：留够高度让大象、石堆、大秤都站在岸上 */
  bankTop: 1080,
  boatX: 400,
  hullWidth: 460,
  hullHeight: 160,
  /** 大象（重物）在沙滩上的落点 */
  heavyHome: { x: 152, y: 1176 },
  /** 大秤：既能被压垮（第一步），也是最后称石头的地方（第四步） */
  scalePos: { x: 606, y: 1168 },
  /** 结算等式放在空着的天空区域，和水面上的船分开 */
  equationY: 330,
} as const;

/** 三种石头的取用点（数量无限，随便搬） */
export const SUB_PILES = [
  { x: 322, y: 1192 },
  { x: 402, y: 1210 },
  { x: 462, y: 1218 },
] as const;

/** 船的可放置区域（比船身宽松，小朋友不用对准） */
export const SUB_BOAT_DROP = { x: 400, y: 560, w: 600, h: 500 } as const;
export const SUB_SCALE_DROP = { x: 606, y: 1108, w: 260, h: 300 } as const;

// ---------- tap：连点 / 长按推进（画面由各游戏自绘） ----------
export const TAP = {
  /** 计数气泡固定在底部，画面变化时它不动 */
  counterY: 1256,
} as const;

// ---------- place：把光球放回世界 ----------
export const PLACE = {
  skyTop: 150,
  skyBottom: 640,
  earthBottom: 1128,
  /** 归位宽容度：在槽位半径上再加这么多像素 —— 要对准，但不必像素级对准 */
  dropForgive: 52,
} as const;

// ---------- sort：先尝后分 ----------
export const SORT = {
  /** 归位宽容度：和 place 一样，要对准但不必像素级对准 */
  dropForgive: 52,
  /** 拿起东西时，该去的地方发光的光圈外扩 */
  hintRing: 22,
  /** 尝一口的默认时长 */
  tasteMs: 1000,
} as const;

// ---------- trace：手指划出一条路 ----------
export const TRACE = {
  /** 河道画多粗 */
  channelWidth: 32,
  /** 拿起手指时，下一处目标的提示光圈外扩 */
  hintRing: 18,
  /** 一笔划多久没进展就开始提示 */
  idleMs: 11000,
} as const;

// ---------- wait：等 ----------
export const WAIT = {
  /** 诱惑按钮的命中半径：手指粗也能点得到 */
  temptationRadius: 64,
  /** 等到之后，一直不点"收钩"的兜底时间 —— 绝不会卡住 */
  fallbackMs: 16000,
  /** 无头验证时把等待压缩成几分之一 */
  autoplayFactor: 7,
  /** 多久没动静就给提示 */
  idleMs: 11000,
} as const;

// ---------- mark：在会动的世界上做记号 ----------
export const MARK = {
  /** 刻记号的命中宽容度：手指粗也能刻到 */
  carveForgive: 54,
  /** 刻完之后多久开船（给孩子看一眼自己刻的记号） */
  carveHoldMs: 1200,
  /** 下水捞一趟的时长 */
  diveMs: 1400,
  /** 捞空之后，船回到上游、记号清掉的停顿 */
  retryHoldMs: 1800,
  /** 无头验证时把漂船压成几分之一 */
  autoplayFactor: 7,
  /** 多久没动静就把小手放到船帮上 */
  idleMs: 8000,
} as const;

// ---------- split：总量不变，换个分法 ----------
export const SPLIT = {
  /**
   * 木牌（分界）的命中半径。
   * 必须小于一格（七颗时约 64px），否则"点绳子上想分的地方"会跟"拖木牌"抢判定。
   */
  dividerRadius: 58,
  /** 猴子看完新分法的反应时间 */
  reactMs: 900,
  /** 多久没动静就把小手放到木牌上 */
  idleMs: 11000,
} as const;

// ---------- burrow：预留退路 ----------
export const BURROW = {
  /** 土坡的命中宽容度 */
  digForgive: 44,
  /** 挖一铲之后，危险出现的停顿（让孩子看清自己挖了几个洞） */
  firstWaveDelayMs: 1400,
  /** 危险守在洞口 / 从洞口脱身的一次演出 */
  dangerMs: 2400,
  /** 两次危险之间的呼吸 */
  gapMs: 1400,
  /** 无头验证时把这些演出压成几分之一 */
  autoplayFactor: 5,
  /** 多久没动静就把小手放到还没挖的土坡上 */
  idleMs: 9000,
} as const;

// ---------- 典故卡 ----------
/** 卡片高度按内容实测得出，所以这里只给宽度、内边距与可用区域 */
export const REWARD = {
  cardX: 60,
  cardW: 630,
  // 40 而不是 48：内边距小一点 → 换行宽度大一点 → 英文长句少折一行，
  // 同时上下各多出 8px。字号提到 28 之后，最坏的英文卡余量只剩 2%。
  cardPad: 40,
  /** 卡片可用的纵向区间（下方给"收下"按钮留出位置） */
  regionTop: 166,
  regionBottom: 1120,
  done: { x: 375, y: 1190 },
} as const;
