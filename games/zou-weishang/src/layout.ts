/**
 * 晋军这一屏：从北边的营地一路往南退，退满三舍九十里，最后退进城濮 ——
 * 城墙高、粮草足、友军等着的地方。手指从上一段的终点继续往下划，一舍一舍划过去。
 *
 * 路线每一段的起点与终点都写在关卡脚本里（内容 JSON）—— 这里放的是"景"的位置：
 * 三块里程碑（一舍三十里）与城濮的城门**必须落在关卡数据画的那条路上**，
 * 单测把两边逐一对起来，免得路标画在这儿、判定却在别处。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene */
export const SKY_TOP = 150;
/** 晋军出发的营地（画面上方）：追兵从它北边的尘土里来 */
export const HOME_CAMP = { x: 375, y: 392 } as const;
/** 楚军追来的尘土：等在营地北边的天边 */
export const DUST = { x: 375, y: 226 } as const;
/** 里程碑画在路的右边（不压住要划的那条路） */
export const POST_OFFSET = 88;
/**
 * 三舍的落脚点：一舍三十里，里程碑上的刻痕一道一道加上去。
 * 关卡数据里三段的终点必须与这三个点逐一对上（第三舍就是城濮的城门）。
 */
export const SHES = [
  { id: 'she1', x: 375, y: 648, notches: 1 },
  { id: 'she2', x: 375, y: 828, notches: 2 },
  { id: 'she3', x: 375, y: 1028, notches: 3 },
] as const;
/** 城濮：退到这儿，人和东西都保住了 —— 最后一段的终点就是这扇门 */
export const SAFE_CAMP = { x: 375, y: 1028, radius: 78 } as const;
/** 城头上的两面友军旗：城门开的时候它们一起立起来 */
export const ALLY_FLAGS = [
  { x: 176, y: 962 },
  { x: 574, y: 962 },
] as const;
