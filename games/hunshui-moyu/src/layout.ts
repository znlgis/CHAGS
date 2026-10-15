/**
 * 混水摸鱼这一屏：岸上有一棵柳树和一只竹篓，水塘从岸边一直铺到画面底部，
 * 水里三条鱼；靠近岸边的地方是**搅水的那一圈**（竹竿点下去，水就浑了）。
 *
 * 三条鱼与搅水圈的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 岸从它下面开始 */
export const BANK_TOP = 150;
/** 岸与水面的分界：上面是土岸，下面是水 */
export const WATER_TOP = 430;
/** 水塘（画面底部一直到边） */
export const POND = { top: WATER_TOP, bottom: DESIGN_H } as const;
/** 搅水的那一圈（关卡数据里的 stir 必须一字不差地用这个位置） */
export const STIR_SPOT = { x: 375, y: 560, radius: 96 } as const;
/** 三条鱼的位置（关卡数据必须一字不差地用这一串；顺序与内容 JSON 一致） */
export const FISH_SPOTS = [
  { id: 'carp', x: 175, y: 880 },
  { id: 'crucian', x: 575, y: 800 },
  { id: 'grass', x: 375, y: 1140 },
] as const;
/** 鱼的命中半径（画出来比它大一圈：鱼是有尾巴的） */
export const FISH_RADIUS = 92;
/** 竹篓：摸到的鱼放进岸上的这只篓里 */
export const CREEL = { x: 632, y: 300 } as const;
/** 岸上的柳树与石头 */
export const WILLOW = { x: 112, y: 320 } as const;
export const ROCK = { x: 470, y: 356 } as const;
/** 浑度尺（水快清了看得见）：竖在水塘右边 */
export const MURK_GAUGE = { x: 692, y: 620, w: 36, h: 430 } as const;
/** 搅水用的竹竿画在哪儿（斜插进水里） */
export const POLE = { from: { x: 268, y: 452 }, to: { x: 372, y: 576 } } as const;
