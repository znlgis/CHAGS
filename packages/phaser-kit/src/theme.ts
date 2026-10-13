import type Phaser from 'phaser';

/** 圆润卡通配色：厚描边 + 暖亮色，比纯黑描边更柔和 */
export const THEME = {
  outline: 0x3a2f26,
  ink: 0x3a2f26,
  inkSoft: 0x6b5a49,
  paper: 0xfdf3dc,
  paperDeep: 0xf0e0bd,
  card: 0xfffaf0,
  red: 0xe0554a,
  redDeep: 0xb03a31,
  teal: 0x3d8f86,
  tealDeep: 0x2c6b64,
  gold: 0xf2b134,
  goldDeep: 0xc98a1c,
  sky: 0xc6e8f5,
  skyDeep: 0x9fd4ea,
  water: 0x59abda,
  waterDeep: 0x3283b3,
  sand: 0xf3e0b0,
  sandDeep: 0xdfc78d,
  wood: 0xc98a4b,
  woodDeep: 0x96612b,
  stone: 0xaeaaa2,
  stoneDeep: 0x827d75,
  elephant: 0xb6b1a8,
  elephantDeep: 0x918c84,
  leaf: 0x74b96c,
} as const;

export const CSS = {
  ink: '#3a2f26',
  inkSoft: '#6b5a49',
  paper: '#fdf3dc',
  card: '#fffaf0',
  red: '#e0554a',
  teal: '#3d8f86',
  gold: '#c98a1c',
  white: '#ffffff',
  /**
   * 深色版本，用于浅底上的文字与图标。
   * 原始色放在浅底上对比度不够：红/纸 3.42:1、青/纸 3.48:1、金/卡 2.83:1，
   * 都过不了 WCAG AA。下面这三个分别是 5.44 / 5.61 / 5.42。
   */
  redDeep: '#b03a31',
  tealDeep: '#2c6b64',
  goldDeep: '#8a5f10',
} as const;

export const FONT_STACK =
  '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';

export function textStyle(
  size: number,
  color: string = CSS.ink,
  bold = false,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_STACK,
    fontSize: size + 'px',
    color,
    fontStyle: bold ? 'bold' : 'normal',
  };
}
