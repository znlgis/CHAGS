import type Phaser from 'phaser';

/** 手势守卫：同一时刻只认一根手指（见下面的 use 说明） */
export interface GestureGuard {
  /** 手势开始：没有别的手指在做手势就认下这一根，返回 true；否则 false（调用方直接 return） */
  begin(pointer: Phaser.Input.Pointer): boolean;
  /** 这个 move/up 是不是正在做手势的那根手指 */
  isActive(pointer: Phaser.Input.Pointer): boolean;
  /** 手势结束（松手 / 放手） */
  end(pointer: Phaser.Input.Pointer): void;
  /** 场景重开之类的场合，硬清空 */
  reset(): void;
}

/**
 * "只认先落下的那根手指"。
 *
 * 开了多点触控（createGame.ts 的 `input.activePointers`）之后，**有状态的连续手势**
 * ——拖拽、划线、按住蓄力——必须自己挑一根手指，否则第二根手指会：
 * - 把正在画的线接走（`pointermove` 换成了另一根指尖）；
 * - 在你还按着的时候替你"松手"（`pointerup` 是任意一根手指抬起都会发的）。
 *
 * 单点操作（点按钮、连点推进）不需要它：那类交互本来就应该"哪根手指都算"。
 *
 * 典型用法（模板里的 onDown/onMove/onUp）：
 * ```ts
 * private readonly gesture = createGestureGuard();
 *
 * this.input.on('pointerdown', (pointer) => {
 *   if (!this.gesture.begin(pointer)) return; // 已经有手指在做手势
 *   ...
 * });
 * this.input.on('pointermove', (pointer) => {
 *   if (!this.gesture.isActive(pointer)) return;
 *   ...
 * });
 * this.input.on('pointerup', (pointer) => {
 *   if (!this.gesture.isActive(pointer)) return;
 *   this.gesture.end(pointer);
 *   ...
 * });
 * ```
 *
 * 注意：手指的 `id` 是 Phaser 的指针槽位号（0 = 鼠标，1.. = 触点），
 * 同一次按下的 down…up 之间稳定。
 */
export function createGestureGuard(): GestureGuard {
  let activeId: number | null = null;
  return {
    begin(pointer: Phaser.Input.Pointer): boolean {
      if (activeId !== null) return false;
      activeId = pointer.id;
      return true;
    },
    isActive(pointer: Phaser.Input.Pointer): boolean {
      return activeId !== null && pointer.id === activeId;
    },
    end(pointer: Phaser.Input.Pointer): void {
      if (activeId === pointer.id) activeId = null;
    },
    reset(): void {
      activeId = null;
    },
  };
}
