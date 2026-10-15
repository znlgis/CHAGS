/**
 * 井陉口这一屏：韩信把赵军引上营垒，梯子一级一级搭在土墙上 ——
 * 墙脚、梯子的每一级、抽梯的绳桩、顶上他去的地方，都写在这儿；
 * **关卡脚本（内容 JSON）必须一字不差地用这一串坐标**，单测把两边对起来。
 *
 * 最要紧的一条是**每一级都点得开**：四级阶梯各隔 220 像素，
 * 而点一下的判定半径是 RUNG_RADIUS + 40（见 art/logic.test.ts），
 * 手指粗也不会点到隔壁那一级上去。
 */
export const DESIGN_W = 750;
export const DESIGN_H = 1334;
/** 标题条（0..150）留给 BaseScene —— 晨光从它下面开始 */
export const SKY_TOP = 150;
/** 营垒的顶面（他要去的地方就在墙头上） */
export const WALL_TOP = 540;
/** 墙脚 = 地面：土墙从 WALL_TOP 到这儿 */
export const GROUND_TOP = 980;
/** 梯脚落在地上哪儿 */
export const LADDER_FOOT = { x: 200, y: 1200 } as const;
/** 梯子搭上墙头的那一点 */
export const LADDER_TOP = { x: 540, y: 540 } as const;
/** 四级阶梯（关卡数据里的 rungs 一字不差地用它；从下往上、按顺序搭） */
export const RUNGS = [
  { id: 'r1', x: 237, y: 1129 },
  { id: 'r2', x: 337, y: 933 },
  { id: 'r3', x: 438, y: 738 },
  { id: 'r4', x: 539, y: 542 },
] as const;
/** 一级阶梯的命中半径（画出来的横杆比它长一号） */
export const RUNG_RADIUS = 52;
/** 抽梯的绳桩：梯脚上的绳子拴在这根木桩上，点它就是抽梯 */
export const PULL = { x: 620, y: 1180, radius: 84 } as const;
/** 他要去的地方：营垒顶上的粮囤与帅旗（关卡数据里的 bait 用它） */
export const BAIT = { x: 640, y: 420, radius: 96 } as const;
/** 他沿梯往上走多久 —— 与关卡数据里的 climbMs 一致 */
export const CLIMB_MS = 3200;
/** 顶栏下面那句话（≤24 字；英文版 ≤24 字符由译文补丁保证） */
export const HINT = '先搭梯子，等他上去再抽';
/** 底下那条小进度条：四级阶梯搭到几级了 */
export const BAR = { x: 150, y: 1268, w: 450, h: 40 } as const;
