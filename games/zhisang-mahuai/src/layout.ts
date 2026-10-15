/**
 * 指桑骂槐这一屏：秦宫苑囿 —— 画面上方是要漆的那一段宫墙（墙角放着漆桶与刷子），
 * 中间一排四样东西：桑树、槐树、钟、鼓；优旃站在鼓边上。
 * 二世站在台阶下，敲对一次他就往前走一格 —— 走够 steps 步，他自己就改了主意。
 *
 * 四样东西与二世站的位置写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿（他每往前一格都有个落点）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene */
export const SKY_TOP = 150;
/** 要漆的那段宫墙 */
export const WALL = { top: SKY_TOP, bottom: 330, merlonGap: 104 } as const;
/** 墙角那一桶漆与刷子（二世的主意） */
export const LACQUER = { x: 92, y: 402, r: 46 } as const;
/** 宫墙前面那一片地 */
export const GROUND_TOP = 356;
/** 四样东西站的那条线（圆心）—— 关卡数据必须一字不差地用这一串 */
export const PROP_Y = 620;
export const PROP_RADIUS = 76;
export const PROPS = [
  { id: 'mulberry', x: 105, kind: 'mulberry' },
  { id: 'ash', x: 285, kind: 'ash' },
  { id: 'bell', x: 465, kind: 'bell' },
  { id: 'drum', x: 645, kind: 'drum' },
] as const;
/**
 * 他听得懂的那样东西是**鼓**。
 *
 * 关卡脚本里的 `has` 在这个模式下就是"这样东西的类别"（字段名沿用老模式那个，
 * 取值也就 'snake' / 'clear' 两种）：鼓那一样写 'snake'（= listener.wants），
 * 其余三样写 'clear'。四样里**只有一样**是他听得懂的 —— schema 也这么要求。
 */
export const WANTED_ID = 'drum';
/** 优旃站在鼓边上（敲鼓的动静，他先听懂） */
export const YOUSAN = { x: 708, y: 752 } as const;
/**
 * 二世的地上走位：敲对一次，他往前走一格（关卡数据里的 listener 必须是第一格）。
 * 一格一格走过去，最后他站在鼓前头 —— 话听进去了，漆城的事他自己就放下了。
 */
export const LISTENER_PATH = [
  { x: 375, y: 1080 },
  { x: 430, y: 1000 },
  { x: 500, y: 920 },
  { x: 570, y: 845 },
] as const;
export const LISTENER_RADIUS = 80;
/** 要走几步（= 走位的段数）—— 与关卡数据里的 steps 一致 */
export const STEPS = LISTENER_PATH.length - 1;
/** 走一步要多久 —— 与模板 HINT_TIMING.stepMs 一致，画面上那条走位按它插值 */
export const STEP_MS = 1100;
/** 走够几步：左下角的进度槽 */
export const BAR = { x: 40, y: 1256, w: 420, h: 38 } as const;
