/**
 * 一屏柳林靶场：柳树在左，弓箭手在右，地面上一排刻着步数的木牌。
 * 坐标不碰 Phaser，可以脱离浏览器单测；关卡数据里的靶子必须与它一致。
 */
export const SKY_TOP = 150;
export const GROUND_Y = 900;
/** 弓箭手站的那一行 */
export const ARCHER_Y = 1060;
/** 第一档（十步）站的位置，每退一档往右走这么多 */
export const ARCHER_X0 = 380;
export const ARCHER_STEP = 72;
/** 木牌（"再退十步"）的位置 —— 关卡数据里的 ladder.advance 必须与它一致 */
export const ADVANCE = { x: 375, y: 1244, radius: 90 };
/** 五片柳叶：越远越小，也摆得开（不然远的那几片会挤成一团） */
export const LEAVES = [
  { x: 352, y: 430 },
  { x: 280, y: 402 },
  { x: 212, y: 376 },
  { x: 152, y: 352 },
  { x: 96, y: 330 },
] as const;
export const LEAF_RADII = [44, 36, 30, 24, 19] as const;

export function archerAt(rungIndex: number): { x: number; y: number } {
  return { x: ARCHER_X0 + rungIndex * ARCHER_STEP, y: ARCHER_Y };
}
