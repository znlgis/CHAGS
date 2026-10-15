/**
 * 马陵道这一屏：夜里的山谷 —— 两壁夹着一条道，四个山口就是四扇营门
 * （西口、东口、北口、南口）；贼抱着一个小包袱站在道当中，
 * 孙膑的伏兵早就伏在两壁的山脊上。
 *
 * 四个出口与贼的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 * 最要紧的一条是**来得及**：四扇门各 1200 毫秒，加起来 4800 < 贼跑掉的 9000（见 logic.test.ts）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 夜色从它下面开始 */
export const NIGHT_TOP = 150;
/** 山谷的上沿 */
export const VALLEY_TOP = 176;
/** 左壁 / 右壁的山脊折线：山口就开在这两道壁上 */
export const WALL_LEFT = [
  { x: 0, y: VALLEY_TOP },
  { x: 158, y: 296 },
  { x: 74, y: 512 },
  { x: 196, y: 758 },
  { x: 62, y: 1012 },
  { x: 178, y: 1244 },
  { x: 0, y: 1334 },
] as const;
export const WALL_RIGHT = [
  { x: 750, y: VALLEY_TOP },
  { x: 592, y: 296 },
  { x: 676, y: 512 },
  { x: 554, y: 758 },
  { x: 688, y: 1012 },
  { x: 572, y: 1244 },
  { x: 750, y: 1334 },
] as const;
/** 四个出口（关卡数据必须一字不差地用这一串）：西门、东门、北门、南门 */
export const EXITS = [
  { id: 'west', x: 140, y: 620 },
  { id: 'east', x: 610, y: 620 },
  { id: 'north', x: 375, y: 330 },
  { id: 'south', x: 375, y: 1010 },
] as const;
/** 门的命中半径（画出来的门比它窄一号） */
export const EXIT_RADIUS = 84;
/** 一扇门关严要多久 —— 与关卡数据里的 closeMs 一致 */
export const CLOSE_MS = 1200;
/** 贼站在道当中（r = 命中半径，他本身画得比它小） */
export const THIEF = { x: 375, y: 690, radius: 80 } as const;
/** 贼多久之后跑 —— 与关卡数据里的 escapeAfterMs 一致，画面上那条倒计时的钟按它画 */
export const ESCAPE_AFTER_MS = 9000;
/** 孙膑的伏兵：伏在两壁的山脊上（石壁上探出来的那几个身影） */
export const AMBUSH = [
  { x: 96, y: 512, flip: false },
  { x: 120, y: 846, flip: false },
  { x: 654, y: 512, flip: true },
  { x: 630, y: 846, flip: true },
] as const;
/** 倒计时的钟 + 四扇门的小图示：贼还有多久跑，一眼看得见 */
export const BAR = { x: 150, y: 1264, w: 450, h: 44 } as const;
