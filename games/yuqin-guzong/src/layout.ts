/**
 * 一条山道一屏：天、山、蜿蜒的路、一前一后两个人影，
 * 上方是对方的体力条与这段追逐的进度，下方是"按住就能追"的那颗大按钮。
 *
 * 两个人影的横坐标由**关卡数据里的距离**算出来（见 art.ts 的 runnerX）——
 * 距离不是数字，是看得见的远近。这里放的是景与两条槽；
 * 单测把两边对起来：按钮画在哪儿，关卡数据里的 hold 就得在哪儿。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 暮色从天开始（标题条下面） */
export const SKY_TOP = 150;
/** 两重山脊 */
export const RIDGES = [
  { y: 470, color: 'far' },
  { y: 590, color: 'near' },
] as const;
/** 山道：一条从左边爬到右边的土路 */
export const PATH = { left: -20, right: 770, top: 700, bottom: 1040 } as const;
/** 追的人（诸葛亮）站在左边的路上 */
export const PURSUER = { x: 158, y: 880 } as const;
/**
 * 跑的人（孟获）：距离 0 时最近（340），距离 100 时最远（650）——
 * 关卡数据里的 distance 就是画面上的这一段横坐标。
 */
export const RUNNER = { minX: 340, maxX: 650, y: 828 } as const;
/** 中间那条"距离"刻度：要维持的区间用绿色标出来 */
export const RULER = { x: 90, y: 986, w: 570, h: 46 } as const;
/** 上方对方的体力条 */
export const STAMINA = { x: 90, y: 190, w: 570, h: 52 } as const;
/** 这段追逐的进度（体力条下面一条细的） */
export const PROGRESS = { x: 90, y: 266, w: 570, h: 26 } as const;
/** 按住这里追：一个大圆钮（关卡数据里的 hold 必须一字不差地用这一组） */
export const HOLD = { x: 375, y: 1165, radius: 120 } as const;
/** 体力条与进度条的圆角 */
export const BAR_RADIUS = 26;

/** 距离 → 画面上的横坐标：0 在最近处，100 在最远处（关卡数据里的 distance 就是这一段） */
export function runnerX(distance: number): number {
  const t = Math.max(0, Math.min(100, distance)) / 100;
  return RUNNER.minX + t * (RUNNER.maxX - RUNNER.minX);
}

/** 距离 → 画面上的大小：越远人影越小（跟丢的时候一眼看得出来） */
export function runnerScale(distance: number): number {
  const t = Math.max(0, Math.min(100, distance)) / 100;
  return 1 - 0.32 * t;
}
