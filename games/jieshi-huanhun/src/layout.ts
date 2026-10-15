/**
 * 黄昏的空地一屏：一根旗杆立在中央，三面还能用的旗插在下面，散掉的人影散在四周，
 * 地上还躺着一面倒下的旧旗。
 *
 * **"尸"字只在计名里**（借尸还魂，按方案保留）—— 画面上没有尸体，
 * 只有一面旧旗和一群散掉的人。
 *
 * 旗 / 散人 / 旗杆的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**与美术常量，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 天与地的交界：人和旗都站在这一条线上 */
export const GROUND_Y = 1000;
/** 旗杆：关卡数据里的 pole 必须一字不差地用这一组 */
export const POLE = { x: 375, y: 560, radius: 140 } as const;
/** 杆顶与杆底（画旗杆用） */
export const POLE_TOP_Y = 300;
export const POLE_BASE_Y = GROUND_Y;
export const POLE_WIDTH = 22;
/** 竖起来的旗挂在杆上的高度（一杆可以挂几面） */
export const RAISED_Y = 392;
/** 倒下的那面旧旗：它一直躺在泥里，是这一计的由头 */
export const FALLEN = { x: 636, y: 1014 } as const;
/** 三面还能用的旗（关卡数据里的 flags 必须一字不差地用这一列） */
export const FLAGS = [
  { id: 'torn', x: 120, y: 1090, radius: 92, rally: 2 },
  { id: 'red', x: 375, y: 1130, radius: 92, rally: 4 },
  { id: 'long', x: 630, y: 1090, radius: 92, rally: 3 },
] as const;
/** 散落的人（关卡数据里的 scattered 必须一字不差地用这一列） */
export const SCATTERED = [
  { id: 'p1', x: 90, y: 660, radius: 54 },
  { id: 'p2', x: 250, y: 800, radius: 54 },
  { id: 'p3', x: 500, y: 790, radius: 54 },
  { id: 'p4', x: 665, y: 640, radius: 54 },
  { id: 'p5', x: 170, y: 930, radius: 54 },
  { id: 'p6', x: 600, y: 930, radius: 54 },
] as const;
/** 旗面画多大（比命中半径大一点，旗上 rally 几个点看得清） */
export const FLAG_W = 132;
export const FLAG_H = 88;

/** 归队之后站在旗杆下的位置：一左一右轮着排，都在画面里 */
export function rallySpot(index: number): { x: number; y: number } {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  // 128 + row×84：三排下来最外的一个也还留在画面里（x 79 / 671）
  return { x: POLE.x + side * (128 + row * 84), y: GROUND_Y - row * 12 };
}
