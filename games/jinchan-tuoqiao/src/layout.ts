/**
 * 营寨这一屏：夜里的大营（帐幕、鼓、旗、岗楼）、一排"还站在那儿"的岗位、地上的草堆、右边的院门。
 *
 * 五个岗位与五个替身的坐标写在关卡脚本里（内容 JSON）—— 这里放的是**景**的位置，
 * 单测把两边对起来：美术画在哪儿，关卡数据就得在哪儿
 * （岗位落在大营的墙下那一排，替身躺在墙根的草堆里，院门在右下角）。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 夜色从它下面开始 */
export const SKY_TOP = 150;
/** 大营的墙：岗位就在墙下那一排 */
export const WALL_TOP = 470;
export const WALL_BOTTOM = 640;
/** 一排岗位：五个位置，间距一致（关卡数据必须一字不差地用这一串） */
export const POST_XS = [95, 235, 375, 515, 655] as const;
export const POST_Y = 560;
export const POST_RADIUS = 62;
/** 五个岗位各自的样子：鼓 / 旗 / 火把 / 矛 / 号角（替身要挑同 kind 的） */
export const POST_KINDS = ['drum', 'flag', 'torch', 'spear', 'horn'] as const;
/** 营外的地面（草堆与院门都在这一片） */
export const GROUND_TOP = 760;
/** 替身躺着的草堆：同样五个位置，但**样子是打乱的** —— 要挑，不是照着放 */
export const SPARE_XS = [95, 235, 375, 515, 655] as const;
export const SPARE_Y = 1010;
export const SPARE_RADIUS = 62;
export const SPARE_KINDS = ['flag', 'horn', 'drum', 'spear', 'torch'] as const;
/** 院门：全换好之后从这里走掉（关卡数据里的 exit 必须是它） */
export const GATE = { x: 620, y: 1236, radius: 76 } as const;
/** 岗楼：检查者站在上面，每隔 peekMs 抬头看一次 */
export const TOWER = { x: 655, y: 330 } as const;
/** 帐幕（营里睡着的人早就走了 —— 这儿只是景） */
export const TENTS = [
  { x: 158, y: 356, w: 168, h: 112 },
  { x: 396, y: 322, w: 148, h: 100 },
] as const;
/** 草堆的范围（垫在地上的那一圈影子） */
export const PILE_TOP = 940;
export const PILE_BOTTOM = 1096;
