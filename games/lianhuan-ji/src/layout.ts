/**
 * 赤壁江面这一屏：南岸是起头的火种，往北是一环一环连起来的船团 ——
 * 一环点亮之后，火顺着铁索传到下一环，中间不能断。
 *
 * 四环与火种的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 * 最要紧的是**顺序**：环的先后就是火走的先后 —— 一环接一环。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 江色从它下面开始 */
export const SKY_TOP = 150;

/** 北边最远处的水天线（江的尽头） */
export const RIVER_TOP = 236;
/** 南岸的沙滩：起头的火种就在岸上（江水到这条线为止） */
export const SHORE_Y = 1074;

/**
 * 起头的地方：南岸的火种（关卡数据里的 ignite 必须是它）。
 * 孩子先点着它，链子才从第一环开始走。
 */
export const IGNITE = { x: 130, y: 1130, radius: 84 } as const;

/**
 * 四环：按点亮的先后排（关卡数据里的 links 必须一字不差地用这一串）。
 * 火从南岸出发，一路往北：一环接一环，最后连到最北边的大船团。
 */
export const RINGS = [
  { id: 'ring-1', x: 380, y: 970 },
  { id: 'ring-2', x: 620, y: 760 },
  { id: 'ring-3', x: 300, y: 545 },
  { id: 'ring-4', x: 560, y: 335 },
] as const;

/** 每一环的命中半径（画出来的船团比它宽一号 —— 手指粗也点得到） */
export const RING_RADIUS = 76;
/** 一环点亮之后下一环的时限 —— 与关卡数据里的 windowMs 一致（沙漏按它画） */
export const WINDOW_MS = 2200;
/** 铁索画多粗：一条链子连着两条船 */
export const CHAIN_WIDTH = 15;
/** 船团里一条小船的长度 */
export const BOAT_LENGTH = 132;
/** 江面上的水纹（固定几道，别让每帧都在抖） */
export const WAVES = [
  { x: 90, y: 300, w: 190, a: 0.5 },
  { x: 470, y: 380, w: 240, a: 0.42 },
  { x: 150, y: 640, w: 210, a: 0.46 },
  { x: 560, y: 900, w: 180, a: 0.4 },
  { x: 240, y: 986, w: 230, a: 0.34 },
] as const;
