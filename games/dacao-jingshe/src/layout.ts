/**
 * 打草惊蛇这一屏：五代县衙的后院 —— 一条小路从左下角斜着通到右边的院门，
 * 五丛草长在路边，王鲁拿着竹竿站在这一头。
 *
 * 五丛草的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 * 最要紧的一条是**解**：必须有一丛空草落在任何蛇的惊动范围之外（见 logic.test.ts）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条下面就是院墙 */
export const GROUND_TOP = 150;
/** 院墙到后院的交界：墙根 */
export const YARD_TOP = 470;
/** 小路：从王鲁脚下斜着通到院门，五丛草就长在这条线两边 */
export const ROAD = { from: { x: 60, y: 1150 }, to: { x: 700, y: 640 }, width: 150 } as const;
/** 五丛草的中心（关卡数据必须一字不差地用这一串） */
export const PATCHES = [
  { id: 'c1', x: 110, y: 1090 },
  { id: 'c2', x: 228, y: 1008 },
  { id: 'c3', x: 346, y: 926 },
  { id: 'c4', x: 464, y: 844 },
  { id: 'c5', x: 604, y: 754 },
] as const;
/** 草丛的命中半径（画出来比它大一圈：草是有叶子的） */
export const PATCH_RADIUS = 64;
/** 敲到蛇时，这么大的范围里的草丛一起被搅乱（与关卡数据里的 scareRadius 一致） */
export const SCARE_RADIUS = 150;
/** 院门（exit）：确认安全之后从这儿出去 */
export const EXIT = { x: 690, y: 660, radius: 58 } as const;
/** 王鲁站在小路的这一头 */
export const WALKER = { x: 96, y: 1210 } as const;
/** 竹竿多长 —— 拿它拨草 */
export const POLE_LEN = 116;
/** 院墙上挂的灯笼 */
export const LANTERNS = [
  { x: 150, y: 300 },
  { x: 600, y: 300 },
] as const;
