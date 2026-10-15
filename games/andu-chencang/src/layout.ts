/**
 * 夜里的秦岭一屏：左边的崖上修着栈道（明线），右边一条小路绕上陈仓（暗线）。
 *
 * 两条线的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：栈道那一摞木板竖在 decoy 上，小路得从 real 的命中圈里穿过去。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 夜色从标题条下面开始 */
export const SKY_TOP = 150;
/** 山脚线：两条线都从这里起步 */
export const GROUND_Y = 1210;
/** 左边那面崖：栈道修在它上面 */
export const CLIFF = { left: 0, right: 366, top: 210, bottom: 1210 } as const;
/** 栈道（明线）：一条沿着崖面横着修过去的路 —— 修到哪儿，就是明线的值 */
export const PLANK = { x0: 120, y: 980, boardW: 30, boards: 8 } as const;
/** 栈道的正中（= 关卡数据里 decoy 的位置） */
export const PLANK_CENTER = PLANK.x0 + (PLANK.boardW * PLANK.boards) / 2;
/** 小路（暗线）：从山脚绕到城门 */
export const PATH = { x: 560, bottomY: 1150, topY: 460, swing: 92 } as const;
/** 小路上一共几对脚印（= 暗线要点几下） */
export const FOOT_STEPS = 25;
/** 远处的陈仓城 */
export const CITY = { x: 430, y: 300, w: 300, h: 170 } as const;
/** 月亮：从崖后面探出来（不压标题条） */
export const MOON = { x: 392, y: 236, r: 46 } as const;
/** 夜里固定的几颗星（画一次，不闪） */
export const STARS = [
  { x: 96, y: 214 }, { x: 190, y: 184 }, { x: 300, y: 242 }, { x: 452, y: 198 },
  { x: 470, y: 166 }, { x: 700, y: 176 }, { x: 726, y: 320 }, { x: 330, y: 178 },
] as const;

/**
 * 小路上的一点：t 从 0（山脚）到 1（城门）。
 * 美术与单测共用它 —— "脚印得落在命中圈里"这件事是算出来的，不是看着差不多。
 */
export function pathAt(t: number): { x: number; y: number } {
  const k = Math.max(0, Math.min(1, t));
  return {
    x: PATH.x + Math.sin(k * Math.PI * 1.7) * PATH.swing,
    y: PATH.bottomY + (PATH.topY - PATH.bottomY) * k,
  };
}
