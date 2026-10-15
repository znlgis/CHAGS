/**
 * 空城计这一屏：汉水边的一座营寨 —— 一段夯土的营墙横在画面下半截，营门开在正中间。
 * 赵云站在墙头上（旗子放倒、鼓不敲，就是"偃旗息鼓"）；营门前的路上站着来看虚实的曹军。
 *
 * 他"正盯着看"的时候站在哪儿、"移开目光"的时候退到哪儿，都写在这儿；
 * **关卡脚本（内容 JSON）必须一字不差地用这一串坐标**，单测把两边对起来
 * （美术画在哪儿，关卡数据就得在哪儿）。
 *
 * 最要紧的一条是**营门够大、离人够远**：孩子点的是营门那一片，
 * 不是赵云、也不是来看虚实的曹军 —— 手粗也点不到人身上去。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 暮色从它下面开始 */
export const SKY_TOP = 150;
/** 远处的山脊（汉水对岸） */
export const HILL_TOP = 462;
/** 汉水：营墙背后那一条水 */
export const RIVER_TOP = 528;
export const RIVER_BOTTOM = 620;
/** 营墙（夯土墙 + 一排垛口）的上沿与下沿 */
export const WALL_TOP = 620;
export const WALL_BOTTOM = 980;
/** 营门：关卡数据里的 gate 一字不差地用它（大开营门是开局唯一的动作） */
export const GATE = { x: 375, y: 820, radius: 150 } as const;
/** 赵云站在营墙上（脚在墙头，手里不拿兵器 —— 他只是站着） */
export const ZHAOYUN = { x: 176, y: WALL_TOP } as const;
/** 墙头上那面蒙着布的鼓（不敲 —— 息鼓） */
export const DRUM = { x: 268, y: WALL_TOP - 34 } as const;
/** 放倒的两面旗（偃旗）：旗杆躺在墙头上 */
export const FLAGS = [
  { x: 566, y: WALL_TOP - 26 },
  { x: 666, y: WALL_TOP - 20 },
] as const;
/** 营门前面那条路的地面 */
export const ROAD_TOP = 980;
/** 他盯着看的时候站在哪儿：营门正前方的路上，抬头往上看 */
export const WATCH = { x: 375, y: 1180 } as const;
/** 他把目光移开、退到哪儿：路那一头，背过身去 */
export const AWAY = { x: 652, y: 1152 } as const;
/** 三轮盯着看：每一轮他看多久、移开目光多久（关卡数据一字不差地用它） */
export const WATCHES = [
  { id: 'w1', watchMs: 3400, gapMs: 1800 },
  { id: 'w2', watchMs: 3000, gapMs: 1600 },
  { id: 'w3', watchMs: 2600, gapMs: 1600 },
] as const;
/** 要忍住几轮（三轮里忍住两轮，他就先疑心了） */
export const NEEDED = 2;
/** 顶栏下面那句话（≤24 字；英文版 ≤24 字符由译文补丁保证） */
export const HINT = '他盯着的时候，一下都别动';
/** 动了几次留下的记号最多画几个（多了会糊成一片） */
export const MAX_MARKS = 5;
