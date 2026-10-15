/**
 * 魏国院子里的一屏：孙膑坐在席子上装糊涂，魏兵举着灯笼一次次来试探 ——
 * 他"正盯着"的时候站在哪儿、"走开"的时候站在哪儿，孙膑悄悄动手的地方在哪儿，
 * 都写在这儿；**关卡脚本（内容 JSON）必须一字不差地用这一串坐标**，
 * 单测把两边对起来（美术画在哪儿，关卡数据就得在哪儿）。
 *
 * 最要紧的一条是**动手的地方离人够远**：孩子点的是席子边上的竹简案，
 * 不是孙膑、也不是魏兵 —— 手粗也不会点到人身上去。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 暮色从它下面开始 */
export const SKY_TOP = 150;
/** 院墙的墙头（0 之外的一道土墙，墙后面是魏国的街） */
export const WALL_TOP = 300;
/** 院子地面从这儿开始 */
export const GROUND_TOP = 452;
/** 孙膑坐的席子（假痴不癫：他就是在这儿装着什么都不懂） */
export const SUNBIN = { x: 245, y: 862 } as const;
/** 试探的时候他站在哪儿（灯笼举起来，正对着孙膑） */
export const WATCH = { x: 470, y: 812 } as const;
/** 空档的时候他走开站到哪儿（背过身去，在院子那一头） */
export const AWAY = { x: 662, y: 812 } as const;
/** 悄悄动手的地方：席子边上的竹简案（关卡数据里的 action 一字不差地用它） */
export const ACTION = { x: 375, y: 1150, radius: 130 } as const;
/** 要在空档里行动几次 —— 三次试探，三个空档，一步都不能浪费 */
export const STEPS = 3;
/** 三次试探：每一次试探多久、之后的空档多久（关卡数据一字不差地用它） */
export const TESTS = [
  { id: 't1', testMs: 2600, gapMs: 1800 },
  { id: 't2', testMs: 2400, gapMs: 1600 },
  { id: 't3', testMs: 2200, gapMs: 1600 },
] as const;
/** 顶栏下面那句话（≤24 字；英文版 ≤24 字符由译文补丁保证） */
export const HINT = '他盯着的时候别动，走开再动手';
/** 露馅留下的记号最多画几个（多了会糊成一片） */
export const MAX_MARKS = 5;
