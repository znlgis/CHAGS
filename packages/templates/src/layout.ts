/** 设计分辨率与所有可点击元素的坐标。e2e 直接复用这些常量。 */
export const DESIGN = { width: 750, height: 1334 } as const;

export const SCENE_KEYS = {
  story: 'story',
  balance: 'balance',
  quiz: 'quiz',
  reward: 'reward',
} as const;

export const STORY_ART = { x: 55, y: 290, w: 640, h: 610 } as const;
export const STORY_TITLE_Y = 180;
export const STORY_TEXT_Y = 930;
export const STORY_NEXT = { x: 375, y: 1190 } as const;

export const CHOICE_TITLE_Y = 200;
export const CHOICE_QUESTION_Y = 280;
export const CHOICE_TOAST_Y = 700;
export const CHOICE_OPTIONS = [
  { x: 375, y: 800 },
  { x: 375, y: 960 },
  { x: 375, y: 1120 },
] as const;
export const REVEAL_NEXT = { x: 375, y: 950 } as const;

export const BALANCE = {
  promptY: 190,
  waterY: 560,
  waterBottom: 810,
  hullWidth: 420,
  hullHeight: 150,
  hintY: 840,
  totalY: 1250,
} as const;
export const BALANCE_STONE_BUTTONS = [
  { x: 170, y: 960 },
  { x: 375, y: 960 },
  { x: 580, y: 960 },
] as const;
export const BALANCE_CONTROLS = {
  undo: { x: 240, y: 1120 },
  reset: { x: 510, y: 1120 },
} as const;

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

export const REWARD = {
  card: { x: 60, y: 230, w: 630, h: 830 },
  done: { x: 375, y: 1190 },
} as const;
