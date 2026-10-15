/**
 * 美人计这一屏：吴王夫差坐在殿上，殿下摆着越国送来的三样东西（骏马 / 丝绸 / 宝剑）。
 * 他平时目光落在**最在意的那一样**上 —— 孩子先看出来，再把那一样送上去。
 *
 * 三样东西与他的位置写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿
 * （三张案摆成一条线，他就坐在那张席上）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 殿内的墙从它下面开始 */
export const SKY_TOP = 150;
/** 墙与地面的分界（他坐在席上：头在墙前，身子与席都在地面上） */
export const FLOOR_TOP = 520;
/** 两根殿柱 */
export const PILLAR_XS = [62, 688] as const;
export const PILLAR_TOP = 168;
export const PILLAR_BOTTOM = 900;
/** 墙上的格窗：光从这儿斜进来 */
export const WINDOW = { x: 375, y: 322, w: 214, h: 168 } as const;
/** 他坐的那张席（圆心就是关卡数据里的 target） */
export const KING = { x: 375, y: 520, radius: 96 } as const;
export const DAIS_TOP = 566;
export const DAIS_BOTTOM = 700;
/** 殿下那张地毯（三张案都摆在地毯下沿之外的地面上） */
export const RUG = { x: 375, y: 880, w: 620, h: 200 } as const;
/** 三张案的案面：案上站着那三样东西（圆心就是关卡数据里三样东西的 x/y） */
export const TABLE_Y = 1010;
export const TABLE_XS = [170, 375, 580] as const;
export const TABLE_TOP = 1056;
export const TABLE_BOTTOM = 1112;
export const TABLE_W = 176;
/** 三样东西各自的 kind：与关卡数据一字不差（顺序也一样） */
export const GIFT_KINDS = ['horse', 'silk', 'sword'] as const;
export const GIFT_RADIUS = 88;
/** 殿前那几级台阶（画面最下面） */
export const STEPS = [
  { y: 1160, w: 640 },
  { y: 1214, w: 700 },
  { y: 1268, w: 750 },
] as const;
/** 他的眼睛在多高：目光从这儿落到那样东西上（就是他头顶往下一点） */
export const GAZE_EYE_Y = KING.y - 92;
/** 那束目光在眼睛那一端的宽度 */
export const GAZE_WIDTH = 30;
