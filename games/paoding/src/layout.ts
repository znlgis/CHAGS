/**
 * 牛的八块拼图：每一块都有自己的"缝"（往哪个方向能推出去）。
 * 坐标不碰 Phaser，可以脱离浏览器单测；关卡数据必须与它一致。
 */
export interface PieceDef {
  id: string;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 缝的方向：0 = 向右，90 = 向下（屏幕坐标），负数向上 */
  grooveDeg: number;
  radius: number;
}

export const PIECES: PieceDef[] = [
  { id: 'head', kind: 'head', x: 576, y: 540, w: 150, h: 124, grooveDeg: 0, radius: 92 },
  { id: 'neck', kind: 'neck', x: 492, y: 548, w: 104, h: 136, grooveDeg: -30, radius: 82 },
  { id: 'shoulder', kind: 'shoulder', x: 406, y: 528, w: 132, h: 122, grooveDeg: -60, radius: 84 },
  { id: 'ribs', kind: 'ribs', x: 312, y: 556, w: 146, h: 158, grooveDeg: -90, radius: 92 },
  { id: 'loin', kind: 'loin', x: 228, y: 548, w: 124, h: 138, grooveDeg: -120, radius: 84 },
  { id: 'haunch', kind: 'haunch', x: 140, y: 560, w: 148, h: 156, grooveDeg: 180, radius: 92 },
  { id: 'foreleg', kind: 'foreleg', x: 436, y: 764, w: 74, h: 232, grooveDeg: 90, radius: 84 },
  { id: 'hindleg', kind: 'hindleg', x: 192, y: 776, w: 74, h: 232, grooveDeg: 90, radius: 84 },
];

/** 灯光下的案板 */
export const BOARD_TOP = 980;
/** 刀口小图在右上角（下面留给解开的那些块） */
export const KNIFE = { x: 560, y: 250 };
/** 判定：拖多远才算"推了一下"，以及方向能偏多少度 */
export const PUSH = { minDistance: 64, toleranceDeg: 55 };