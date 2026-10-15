/**
 * 山口这一屏：山那边（远山、炊烟、灯火）、山口（守将站的地方）、山脚（要搬走的箱子）。
 *
 * 三个诱饵点的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿
 * （诱饵点要落在山顶上，箱子要在山脚，守将要在那个豁口里）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 山那边的天从它下面开始 */
export const SKY_TOP = 150;
/** 山那边：远山都在这一带，山顶上就是能放诱饵的地方 */
export const FAR_TOP = 240;
export const FAR_BOTTOM = 470;
/** 三座远山：山顶就是三个诱饵点落脚的地方（顺序与关卡数据里的 baits 一致） */
export const FAR_HILLS = [
  { x: 150, y: 380, r: 190 },
  { x: 375, y: 330, r: 210 },
  { x: 614, y: 400, r: 180 },
] as const;
/** 山那边的小村：炊烟与灯火"闹起来"的地方 */
export const HAMLET = { x: 375, y: 452 } as const;
/** 三个诱饵点的横坐标 / 纵坐标（关卡数据必须一字不差地用这一串） */
export const BAIT_XS = [150, 375, 614] as const;
export const BAIT_YS = [320, 268, 336] as const;
export const BAIT_RADIUS = 66;
/** 近处这道山脊与中间那个豁口（山口）；guard 必须落在 (375, 520) 上 */
export const PASS = { x: 375, y: 520 } as const;
export const PASS_HALF = 46;
export const RIDGE_TOP = 470;
export const RIDGE_BOTTOM = 940;
/** 守将画多高（关卡数据里的 guard.radius 是命中宽容度，比他矮一号） */
export const GUARD_H = 196;
/** 山脚：要搬走的箱子待着的地方（关卡数据里的 prize 必须是这个位置） */
export const GROUND_TOP = 940;
export const CHEST = { x: 560, y: 1000, w: 150, h: 112 } as const;
/** 从山口下山的小路：箱子就在路的尽头 */
export const PATH = [
  { x: 375, y: 566 },
  { x: 404, y: 716 },
  { x: 468, y: 872 },
  { x: 548, y: 980 },
] as const;
