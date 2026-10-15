/**
 * 擒贼擒王这一屏：城外的旷野上排着一模一样的六个人，我们的城头在画面下方，
 * 张巡站在城头拿蒿箭一个个试过去。
 *
 * 六个身影的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿；
 * 谁是王由 KING_INDEX 说清楚（数据里 isKing 的那一个必须落在这一位）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 城外的旷野从标题条下面开始 */
export const FIELD_TOP = 150;
/** 六个身影站的那条线 */
export const FIGURE_Y = 620;
/** 身影的命中半径（画出来比它大一圈） */
export const FIGURE_RADIUS = 72;
/** 六个身影的横坐标（关卡数据必须一字不差地用这一串） */
export const FIGURES = [
  { id: 'w1', x: 90 },
  { id: 'w2', x: 205 },
  { id: 'w3', x: 320 },
  { id: 'w4', x: 435 },
  { id: 'w5', x: 550 },
  { id: 'w6', x: 665 },
] as const;
/** 王是这一排里的第几个（0 起）：数据里 isKing 的那一个必须在这儿 */
export const KING_INDEX = 3;
/** 我们的城头：画面下方那一段城墙的上沿 */
export const WALL = { top: 980, merlonGap: 96 } as const;
/** 张巡站在城头上 */
export const ARCHER = { x: 375, y: 1152 } as const;
/** 试过的人退到一边，站到这条线上 */
export const ASIDE_Y = 900;
/** 退到一边时往两边让开多少 */
export const ASIDE_SHIFT = 42;
/** 蒿箭：一根秆 + 头上一撮草穗（没有杀伤） */
export const ARROW = { len: 104, width: 8 } as const;
/** 远处的山与人影 */
export const HILLS = [
  { x: 120, y: FIELD_TOP + 210, w: 420, h: 150 },
  { x: 560, y: FIELD_TOP + 250, w: 520, h: 180 },
] as const;
