/**
 * 偷梁换柱这一屏：大殿的台基上立着四根承重柱（龙纹 / 云纹 / 水纹 / 火纹），
 * 柱子上面压着一根大梁；台基下面堆着四根新柱 —— 外形跟旧的一模一样。
 * 右边站着检查的人（监工），他每隔 checkMs 走一趟，把这一排**清点**一遍。
 *
 * 四根柱子与四根新柱的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿
 * （柱子站在台基上那一条线上，新柱躺在下面的料堆里）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 殿外的天色从它下面开始 */
export const SKY_TOP = 150;
/** 大殿的屋檐（压在柱子上面的大梁就在檐下） */
export const ROOF_TOP = 214;
export const ROOF_BOTTOM = 400;
/** 大梁的下沿：四根柱子顶着它 */
export const BEAM_BOTTOM = 452;
/** 台基（柱子站的那一片石头地）的上沿与下沿 */
export const PODIUM_TOP = 470;
export const PODIUM_BOTTOM = 800;
/** 四根承重柱站的那条线（圆心）—— 关卡数据必须一字不差地用这一串 */
export const POST_Y = 620;
export const POST_RADIUS = 78;
/** 四根柱子各自的花纹：龙 / 云 / 水 / 火（新柱要跟它一样） */
export const POST_KINDS = ['dragon', 'cloud', 'wave', 'flame'] as const;
export const POST_XS = [96, 282, 468, 654] as const;
/** 料堆：四根新柱躺在这儿（位置与花纹跟柱子一一对应） */
export const SPARE_Y = 1040;
export const SPARE_RADIUS = 78;
export const SPARE_XS = [96, 282, 468, 654] as const;
export const SPARE_KINDS = ['dragon', 'cloud', 'wave', 'flame'] as const;
/** 料堆垫在地上的那一块席子（四根新柱都在席子上） */
export const PILE_TOP = 960;
export const PILE_BOTTOM = 1120;
/** 检查的人（监工）站在台阶下：清点的时候他从这儿走上来走一趟 */
export const CHECKER = { x: 375, y: 900 } as const;
/** 殿外的石阶（台基下面那几级） */
export const STEPS = [
  { y: PODIUM_BOTTOM, w: 560 },
  { y: PODIUM_BOTTOM + 46, w: 640 },
  { y: PODIUM_BOTTOM + 92, w: 720 },
] as const;
/** 换一根要按住多久 —— 与关卡数据里的 workMs 一致 */
export const WORK_MS = 1400;
/** 每隔多久清点一次 —— 与关卡数据里的 checkMs 一致，画面上那条刻度按它画 */
export const CHECK_MS = 4200;
