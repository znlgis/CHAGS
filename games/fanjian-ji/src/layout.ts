/**
 * 楚汉相争时的一顶帐：右边那张案是"要让他**自己看到**"的地方，
 * 帐角挂着一串铜铃（弄出点动静的地方），项王的使者在帐里来回踱步。
 *
 * 位置写在这里，数值写进关卡脚本（内容 JSON）—— 单测把两边对起来：
 * 案上那块地方、帐角的铜铃、他踱步的两头，画在哪儿就得在哪儿。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 夜色从标题条下面开始（上面 150 是标题条） */
export const SKY_TOP = 150;
/**
 * 帐幕：顶上留出一截夜色（月亮与星星在 150..330 那一条里），
 * 帐顶横梁压在 330 上，帐里足够放下那张案与他踱步的那条线。
 */
export const TENT = { left: 34, right: 716, top: 330, bottom: 1262 } as const;
/** 案子：案面就是摆东西的地方 */
export const DESK = { x: 96, y: 468, w: 558, h: 176 } as const;
/** 案上那块地方（= 关卡数据里的 spot）：按住 plantMs，把东西一点一点摆上去 */
export const SPOT = { x: 470, y: 556, radius: 88, plantMs: 1600 } as const;
/** 帐角那串铜铃（= 关卡数据里的 redirect）：点一下弄出动静，他转头看别处 */
export const BELL = { x: 170, y: 1110, radius: 96, lookAwayMs: 2600 } as const;
/** 他踱步的两头（= 关卡数据里的 visitor）：from → to → from 是一个来回 */
export const VISITOR_FROM = { x: 610, y: 950 } as const;
export const VISITOR_TO = { x: 250, y: 950 } as const;
export const VISITOR_RADIUS = 96;
/** 一个来回多久（= 关卡数据里的 walkMs） */
export const WALK_MS = 5200;
/** 地席上他踱步的那条线（地席本身由 art 按 DESK 与 TENT 算出来） */
export const FLOOR_Y = 1000;
/** 帐里那盏灯（挂在帐顶右角，不压住案面） */
export const LANTERN = { x: 640, y: 424 } as const;
