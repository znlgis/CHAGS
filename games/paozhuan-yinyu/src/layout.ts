/**
 * 书斋这一屏：题诗的墙、案上的三样东西、站在案前的那位过路人。
 *
 * 三样东西的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿
 * （三样东西要摆在案上，对方要站在案前）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 书斋的墙从它下面开始 */
export const WALL_TOP = 170;
export const WALL_BOTTOM = 528;
export const WALL_LEFT = 55;
export const WALL_RIGHT = 695;
/** 墙上三列：前两列是常建先写下的那两句，第三列空着（等着好句） */
export const VERSE_XS = [205, 375, 545] as const;
/** 对联（换回来的两句好句）写进第三列 */
export const RETURN_COLUMN_X = 545;
/** 对方站在案前：关卡数据里的 partner 必须落在这儿 */
export const PARTNER = { x: 375, y: 700 } as const;
/** 对方拿出东西的那一侧（换回来的"玉"飘在这儿） */
export const RETURN_AT = { x: 592, y: 660 } as const;
/** 案（矮几）：三样东西摆在它上面 */
export const TABLE_Y = 1010;
export const TABLE_LEFT = 45;
export const TABLE_RIGHT = 705;
/** 三样东西的横坐标与命中半径（关卡数据必须一字不差地用这一串） */
export const OFFER_XS = [170, 375, 580] as const;
export const OFFER_RADIUS = 88;
/** 换到几成的进度条（几格玉） */
export const JADE_BAR = { x: 175, y: 826, w: 400, h: 40, cells: 6 } as const;
