/**
 * 渡口一屏：天、海、栈桥、大船，以及会扫过来的那盏灯。
 *
 * 货与外壳的坐标写在关卡脚本里（内容 JSON）—— 这里只放"景"的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿。
 */
export const SKY_BOTTOM = 270;
/** 栈桥桥面：三件货都摆在上面 */
export const DECK_TOP = 600;
export const DECK_BOTTOM = 1240;
export const PIER = { left: 20, right: 730 } as const;
/** 货架这一列：三件货都靠左排开 */
export const SHELF_X = 150;
/** 会扫过来的那盏灯（挂在桥头的灯柱上） */
export const LAMP = { x: 84, y: 470 } as const;
/** 灯亮时照在桥面上的那一片 */
export const BEAM_LAND = { x: 620, y: 900 } as const;
/** 闸口外面的大船：过了检查口的货都往它那儿去 */
export const SHIP = { x: 620, y: 380 } as const;
