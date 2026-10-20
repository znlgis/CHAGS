import { describe, expect, it } from 'vitest';
import { createGestureGuard } from './gesture';

/** 守卫只看 pointer.id（Phaser 的指针槽位号：0 = 鼠标，1.. = 触点），不需要真 Pointer */
const pointer = (id: number) => ({ id }) as unknown as never;

describe('手势守卫：一次连续手势只认一根手指', () => {
  it('第一根手指开始，第二根手指抢不走', () => {
    const guard = createGestureGuard();
    expect(guard.begin(pointer(1))).toBe(true);
    expect(guard.begin(pointer(2))).toBe(false);
    expect(guard.isActive(pointer(1))).toBe(true);
    expect(guard.isActive(pointer(2))).toBe(false);
  });

  it('别的手指抬起不会结束手势（否则拖到一半被"松手"）', () => {
    const guard = createGestureGuard();
    guard.begin(pointer(1));
    guard.begin(pointer(2)); // 被拒
    guard.end(pointer(2)); // 第二根手指抬起：不许影响
    expect(guard.isActive(pointer(1))).toBe(true);
    guard.end(pointer(1));
    expect(guard.isActive(pointer(1))).toBe(false);
  });

  it('松手之后下一根手指可以接着来', () => {
    const guard = createGestureGuard();
    guard.begin(pointer(1));
    guard.end(pointer(1));
    expect(guard.begin(pointer(2))).toBe(true);
    expect(guard.begin(pointer(1))).toBe(false);
  });

  it('reset 能硬清空（场景重开之类）', () => {
    const guard = createGestureGuard();
    guard.begin(pointer(3));
    guard.reset();
    expect(guard.isActive(pointer(3))).toBe(false);
    expect(guard.begin(pointer(4))).toBe(true);
  });
});
