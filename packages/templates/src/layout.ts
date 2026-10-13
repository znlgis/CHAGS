/** 设计分辨率与所有可交互元素的坐标。e2e 直接复用这些常量。 */
export const DESIGN = { width: 750, height: 1334 } as const;

export const SCENE_KEYS = {
  story: 'story',
  chaos: 'chaos',
  substitution: 'substitution',
  grow: 'grow',
  place: 'place',
  quiz: 'quiz',
  reward: 'reward',
} as const;

// ---------- 分幕绘本 ----------
export const STORY_ART = { x: 55, y: 300, w: 640, h: 620 } as const;
export const STORY_TITLE_Y = 205;
export const STORY_TEXT_Y = 985;
export const STORY_TEXT_WRAP = 560;

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

// ---------- grow：把天和地撑开 ----------
export const GROW = {
  /** 天地的分界线：起始时天与地贴在这里 */
  centerY: 640,
  skyTop: 150,
  earthBottom: 1334,
  /** 计数气泡固定在底部，天地移动时它不动 */
  counterY: 1256,
} as const;

// ---------- place：把光球放回世界 ----------
export const PLACE = {
  skyTop: 150,
  skyBottom: 640,
  earthBottom: 1128,
  /** 归位宽容度：在槽位半径上再加这么多像素，小朋友不用对准 */
  dropForgive: 70,
} as const;

// ---------- 复习小考验（复习模式用，首次通关不出现） ----------
export const QUIZ = {
  questionY: 250,
  options: [
    { x: 375, y: 540 },
    { x: 375, y: 700 },
    { x: 375, y: 860 },
    { x: 375, y: 1020 },
  ],
  next: { x: 375, y: 1200 },
} as const;

// ---------- 典故卡 ----------
export const REWARD = {
  card: { x: 60, y: 230, w: 630, h: 830 },
  done: { x: 375, y: 1190 },
} as const;
