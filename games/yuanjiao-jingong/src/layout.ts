/**
 * 远交近攻这一屏：一张摊开的地图 —— 秦都（都城）在图卷中央，
 * 六个势力的城围成一圈：**近的三个在内圈、远的三个在外圈**。
 *
 * 六个城与秦都的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**与**远近**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿；内圈的三个都必须比外圈的三个近。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 图卷从它下面铺开 */
export const MAP_TOP = 150;
/** 秦都（图卷中央）：近的 / 远的都按到它的距离算 */
export const CAPITAL = { x: 375, y: 780, radius: 74 } as const;
/** 六个势力的城（关卡数据必须一字不差地用这一串；顺序与 sequence 一致） */
export const NEIGHBORS = [
  { id: 'han', x: 375, y: 1010 },
  { id: 'wei', x: 140, y: 720 },
  { id: 'zhao', x: 620, y: 640 },
  { id: 'chu', x: 375, y: 1265 },
  { id: 'yan', x: 105, y: 400 },
  { id: 'qi', x: 650, y: 430 },
] as const;
/** 城的命中半径（画出来就是这么大：城墙 + 城垛） */
export const NEIGHBOR_RADIUS = 66;
/** 内圈（近的三个：要处理）与外圈（远的三个：先结好）的半径带 */
export const NEAR_RING = { min: 230, max: 283 } as const;
export const FAR_RING = { min: 445, max: 520 } as const;
/** 城头上的木牌（称呼用 Text 画）挂在城上方多少 */
export const SIGN_DY = -108;
/** 结好的结绳系在城与秦都之间的这一带（沿连线往里 INSET 起） */
export const RIBBON_INSET = 112;
/** 处理好的界桩立在秦都这一侧的城前多远 */
export const STAKE_INSET = 96;
/** 函谷关：秦往东的门（画在图上的一处山口，不参与判定） */
export const PASS = { x: 690, y: 930 } as const;
