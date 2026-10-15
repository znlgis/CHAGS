/**
 * 长坂桥这一屏：一条河横在中间，桥从南岸跨到北岸。
 *
 * 对岸的**林子、土坡与北桥头**就是三个"立旗的支点" —— 旗挂在那儿，河对面的追兵一眼就看见；
 * 张飞自己横矛站在南桥头（他不动，撑起场面的是那几面旗）。
 *
 * 三个支点与河、桥的位置都写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 * 最要紧的两条：**支点都在对岸**（对面看得见的地方），而且彼此点得开（手指粗也不会点到隔壁）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 天色从它下面开始 */
export const SKY_TOP = 150;
/** 对岸（北岸）：追兵从这边来，旗也是挂给他们看的 */
export const FAR_BANK_BOTTOM = 700;
/** 河 */
export const RIVER_TOP = 780;
export const RIVER_BOTTOM = 980;
/** 桥：从北岸跨到南岸（x 是桥心） */
export const BRIDGE = { x: 375, top: FAR_BANK_BOTTOM, bottom: 1046, halfWidth: 98 } as const;
/** 三个支点（关卡数据必须一字不差地用这一串：先林子、再土坡、最后北桥头） */
export const PROPS = [
  { id: 'woods', x: 120, y: 520 },
  { id: 'mound', x: 610, y: 520 },
  { id: 'bridge', x: 375, y: 700 },
] as const;
/** 支点的命中半径：画出来的树 / 土坡 / 桥头比它宽一号，手指粗也点得到 */
export const PROP_RADIUS = 92;
/** 张飞：横矛站在南桥头 */
export const ZHANG_FEI = { x: 375, y: 1074 } as const;
/** 追兵：在北岸的天边（只画得见烟尘与旗号） */
export const ENEMY = { x: 600, y: 296 } as const;
