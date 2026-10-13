import type Phaser from 'phaser';

/** 中国色：朱红 / 黛青 / 米黄 / 墨黑 */
export const THEME = {
  ink: 0x17181d,
  inkSoft: 0x2b2f3a,
  paper: 0xf3e8d2,
  paperDeep: 0xe4d3b2,
  card: 0xfffaf0,
  red: 0xc23b2e,
  redDeep: 0x8d2a20,
  teal: 0x2f6f6b,
  gold: 0xd9a441,
  water: 0x2f6f9f,
  waterDeep: 0x1d4a6e,
  wood: 0x8a5a2b,
  woodDeep: 0x63401d,
  stone: 0x8d8b86,
  stoneDeep: 0x6a6863,
} as const;

export const CSS = {
  ink: '#17181d',
  inkSoft: '#2b2f3a',
  paper: '#f3e8d2',
  paperDeep: '#e4d3b2',
  card: '#fffaf0',
  red: '#c23b2e',
  teal: '#2f6f6b',
  gold: '#d9a441',
  white: '#ffffff',
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
