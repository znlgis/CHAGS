import Phaser from 'phaser';

export interface GrabTarget {
  obj: Phaser.GameObjects.Container;
  /** 抓取半径：小朋友手指粗，判定必须宽松 */
  radius: number;
  /** 什么时候可以被抓（例如“大象上船后就不能再拖”） */
  enabled?: () => boolean;
  onGrab?: (obj: Phaser.GameObjects.Container) => void;
  onDrop?: (obj: Phaser.GameObjects.Container) => void;
}

export interface DragController {
  add(target: GrabTarget): void;
  remove(obj: Phaser.GameObjects.Container): void;
  destroy(): void;
}

/**
 * 不依赖 GameObject 的命中区域，而是“按下时抓住最近的、在半径内的目标”。
 *
 * 原因：Container 的 setInteractive(hitArea) 在 Phaser 4 里的局部坐标约定与直觉不符，
 * 实测会出现“点在 A 上却抓到 80 像素外的 B”。自己算距离既确定，又对小朋友更友好
 * —— 手指粗、点不准也能抓到。
 */
export function createDragController(scene: Phaser.Scene): DragController {
  const targets: GrabTarget[] = [];
  // 记住是**哪一根手指**抓着的：开了多点触控之后，另一根手指抬起不能把手里的东西扔掉
  let active: { target: GrabTarget; dx: number; dy: number; pointerId: number } | null = null;

  const onDown = (pointer: Phaser.Input.Pointer): void => {
    if (active) return;
    let best: GrabTarget | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (target.enabled && !target.enabled()) continue;
      const dist = Math.hypot(pointer.x - target.obj.x, pointer.y - target.obj.y);
      if (dist <= target.radius && dist < bestDist) {
        best = target;
        bestDist = dist;
      }
    }
    if (!best) return;
    active = {
      target: best,
      dx: pointer.x - best.obj.x,
      dy: pointer.y - best.obj.y,
      pointerId: pointer.id,
    };
    best.onGrab?.(best.obj);
  };

  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!active || pointer.id !== active.pointerId) return;
    active.target.obj.setPosition(pointer.x - active.dx, pointer.y - active.dy);
  };

  const onUp = (pointer: Phaser.Input.Pointer): void => {
    // 只认抓住东西的那根手指；另一根手指抬起不放下手里的
    if (!active || pointer.id !== active.pointerId) return;
    const { target } = active;
    active = null;
    target.onDrop?.(target.obj);
  };

  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);

  return {
    add(target: GrabTarget): void {
      targets.push(target);
    },
    remove(obj: Phaser.GameObjects.Container): void {
      const index = targets.findIndex((t) => t.obj === obj);
      if (index >= 0) targets.splice(index, 1);
    },
    destroy(): void {
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('pointerupoutside', onUp);
    },
  };
}

/** 松手后弹回原位；先停掉旧补间，避免和新的拖拽抢位置 */
export function springBack(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.Container,
  x: number,
  y: number,
): void {
  scene.tweens.killTweensOf(obj);
  scene.tweens.add({
    targets: obj,
    x,
    y,
    duration: 260,
    ease: 'Back.easeOut',
  });
}
