/**
 * 乌巢这一屏：夜里的粮草营 —— 一长排粮囤堆在山脚下，正中一堆火，
 * 火底下架着五根柴；曹操的兵举着火把从画面下方摸上来。
 *
 * 火堆与五根柴的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 * 最要紧的一条是**火势**：五根柴的 relief 加起来正好是开局的火势 100（见 logic.test.ts）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 夜色从它下面开始 */
export const NIGHT_TOP = 150;
/** 山脚下的粮草营 */
export const CAMP_TOP = 176;
/** 月亮（天顶那一块留白给提示气泡） */
export const MOON = { x: 606, y: 232, r: 46 } as const;
/** 远山：两座，压在粮囤后面 */
export const HILLS = [
  { x: 132, y: 476, s: 1 },
  { x: 618, y: 442, s: 0.78 },
] as const;
/** 袁绍的粮囤：三个，堆在火堆后面（火就架在粮草边上） */
export const GRANARIES = [
  { x: 116, y: 402, r: 82 },
  { x: 375, y: 350, r: 94 },
  { x: 634, y: 402, r: 82 },
] as const;
/** 火堆：位置与开局火势必须与关卡脚本里的 fire 一致 */
export const FIRE = { x: 375, y: 620 } as const;
export const FIRE_LEVEL = 100;
/** 五根柴摆的位置（关卡数据必须一字不差地用这一串）—— 最后一根是根上的那根 */
export const LOGS = [
  { id: 'l1', x: 170, y: 545 },
  { id: 'l2', x: 580, y: 545 },
  { id: 'l3', x: 170, y: 800 },
  { id: 'l4', x: 580, y: 800 },
  { id: 'l5', x: 375, y: 950 },
] as const;
/** 柴的命中半径（画出来是一根木头，比命中圈长一号） */
export const LOG_RADIUS = 64;
/** 抽出来的柴在画面左下角堆成一堆 */
export const WOODPILE = { x: 118, y: 1082 } as const;
/** 曹操的兵摸上来的地方（画面下方） */
export const RAIDERS = [
  { x: 258, y: 1164 },
  { x: 400, y: 1202 },
  { x: 542, y: 1164 },
] as const;
/** 灭火的进度条：火苗到 0 就满了 */
export const BAR = { x: 150, y: 1272, w: 450, h: 44 } as const;
