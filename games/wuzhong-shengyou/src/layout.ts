/**
 * 雾里的那条船一屏：江、雾、船帮上的一排空位，以及对面那杆"疑心"。
 *
 * 六个空位的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿（空位必须落在船帮上）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 雾从标题条下面就开始，一路漫到江面上 */
export const MIST_TOP = 150;
/** 江面 */
export const WATER_TOP = 620;
/** 船身：从左边伸进雾里的一条木船 */
export const HULL = { left: 40, right: 710, top: 760, bottom: 1180 } as const;
/** 船帮：六个空位就排在这一条线上 */
export const GUNWALE_Y = 880;
/** 船帮上六个空位的横坐标（关卡数据必须一字不差地用这一串） */
export const SLOT_XS = [108, 215, 322, 429, 536, 643] as const;
/** 空位的命中半径：小朋友手指粗，判定要比图形大一点 */
export const SLOT_RADIUS = 62;
/** 草人立起来有多高（画出来比命中半径大得多，看得见） */
export const STRAW_H = 132;
/** 岸边放箭的那一边：在画面左边，雾里只看得见一点轮廓 */
export const FAR_BANK = { x: 40, y: 700 } as const;
/** 箭从哪儿飞进来（画面外的左上角） */
export const ARROW_FROM = { x: -80, y: 770 } as const;
/** 对面的疑心：一条横杆 + 四个小灯（要同时立够四个影子） */
export const SUSPICION = { x: 70, y: 176, w: 400, h: 44 } as const;
export const SHADOW_DOTS = { x: 500, y: 198, gap: 52, r: 18 } as const;
/** 桅杆与帆：让这一条船一眼认得出是船 */
export const MAST = { x: 375, y: 300, h: 480 } as const;
