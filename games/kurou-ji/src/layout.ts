/**
 * 黄盖这一屏：一条船绳横在江面上，绳子两头，一头是我们自己的营，一头是对岸曹营的望楼。
 *
 * 绳上的每一袋粮就是一个"份"：木牌左边的留在营里（**留给自己的**），右边的装船送过江去
 * （**送出去的**）。对岸的探子站在望楼上，眼睛只盯着"送出去的"那一头 ——
 * 送得够多，他才肯信；全送光了，自己人就得饿肚子。这正是这一关的两头。
 *
 * 坐标不碰 Phaser，可以脱离浏览器单测：单测把关卡数据里的两个盘子与画出来的景物对起来。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene */
export const SKY_TOP = 150;
/** 岸与江面的分界：船绳挂在岸的上方，粮袋就悬在江面上 */
export const RIVER_TOP = 760;
/** 大江：只在两岸之间流（关卡数据里的两个盘子必须落在两岸上） */
export const RIVER_LEFT = 292;
export const RIVER_RIGHT = 458;
/** 船绳的高度与两端（关卡数据里的 bins 必须与它一致） */
export const ROPE_Y = 700;
export const LEFT_X = 110;
export const RIGHT_X = 640;
/** 我们自己的营（左岸）：粮囤与几个自己人 */
export const CAMP = { x: 188, y: 1042 } as const;
/** 对岸曹营的望楼：探子站在上面，盯着"送出去的"那一头（整座楼都在岸上，不踩进江里） */
export const TOWER = { x: 508, y: 1000 } as const;
export const WATCHER = { x: 508, y: 878 } as const;
/** 对岸的营（右岸） */
export const FAR_CAMP = { x: 668, y: 1076 } as const;
/** 江上的渡船：送出去的那几袋就从这儿过江 */
export const BOAT = { x: 375, y: 1146 } as const;
