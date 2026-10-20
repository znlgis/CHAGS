/** 命中区矩形（结构上就是 Phaser.Geom.Rectangle；这里的类型不 import Phaser，好让纯数学单测跑在 node 里） */
export interface HitAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 手指不必点得像素级准：命中区在**视觉按钮外圈**再多给这么多。
 *
 * 孩子的手指落点比大人散得多（尤其单手竖握手机时，拇指落点经常偏一点）。
 * 12px 在 750×1334 的设计分辨率上是按钮高度的 1/10 左右：
 * 手抖也能点中，又不会把相邻按钮的判定粘在一起（典故卡两个按钮之间还有 24px 空隙）。
 */
export const TOUCH_PAD = 12;

/**
 * Container 的命中区（交给 `setInteractive`）—— **从 (0,0) 起算，不是从中心起算**。
 *
 * Phaser 做命中测试时（`Phaser.Input.InputManager.hitTest` → `pointWithinHitArea`）：
 *   1. 先把指针换算成对象的**局部坐标**（容器中心 = 0,0）；
 *   2. 再**加上 displayOrigin**，Container 的 displayOrigin 恒为 width/2、height/2；
 *   3. 最后拿这份"左上角原点"的坐标去和 hitArea 做包含判断。
 *
 * 所以本地坐标里，按钮可视区占的是 [0, w] × [0, h]：
 *   - `Rectangle(0, 0, w, h)` → 正好覆盖按钮（本函数 pad = 0 的形态）；
 *   - `Rectangle(-w/2, -h/2, w, h)`（"直觉写法"）→ 可点区整体左上偏移半个按钮，
 *     只有按钮的**左上四分之一**能点中。而 Phaser 的 `Rectangle.Contains` 两端都是
 *     闭区间（`>=`），于是按钮正中心恰好压在可点区的右下角上：
 *     **点正中心偶尔有反应、点中心右侧/下方完全没反应** —— 用户说的"点几次都没反应、
 *     有时候突然又有反应、很随机"就是它。
 *
 * 历史：drag.ts 里"Container 的 setInteractive(hitArea) 局部坐标约定与直觉不符"那句
 * 注释说的也是同一件事（那一处改用自己算距离绕开了）。别把这里改回 -w/2 的写法：
 * hitArea.test.ts 与 e2e/input.spec.ts 都守着它。
 */
export function containerHitArea(w: number, h: number, pad: number = TOUCH_PAD): HitAreaRect {
  return { x: -pad, y: -pad, width: w + pad * 2, height: h + pad * 2 };
}

/** Phaser 的 Rectangle.Contains 等价判断（两端闭区间），单测与工具共用 */
export function hitAreaContains(area: HitAreaRect, localX: number, localY: number): boolean {
  if (area.width <= 0 || area.height <= 0) return false;
  return (
    area.x <= localX &&
    area.x + area.width >= localX &&
    area.y <= localY &&
    area.y + area.height >= localY
  );
}
