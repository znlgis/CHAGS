import { describe, expect, it } from 'vitest';
import { TOUCH_PAD, containerHitArea, hitAreaContains } from './hitArea';

/**
 * 这一条守的是 Phaser 的`hitTest`约定（不是我们发明的数学）：
 * 局部坐标 = (指针 - 按钮中心) + displayOrigin，而 Container 的 displayOrigin
 * 恒为 (width/2, height/2)。命中区必须按"左上角原点"写，写成 (-w/2,-h/2,w,h)
 * 会让可点区整体左上偏半个按钮 —— 这正是用户说的"点几次都没反应、偶尔又有反应"。
 */
function localPoint(pointerX: number, pointerY: number, w: number, h: number) {
  // Phaser.Input.InputManager.hitTest → pointWithinHitArea 的两步换算
  return { x: pointerX + w / 2, y: pointerY + h / 2 };
}

const containsAt = (
  area: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  w: number,
  h: number,
): boolean => {
  const p = localPoint(dx, dy, w, h);
  return hitAreaContains(area, p.x, p.y);
};

describe('Container 命中区：从 (0,0) 起算', () => {
  const w = 288;
  const h = 104;

  it('pad=0 时矩形就是 (0,0,w,h) —— 覆盖整个按钮', () => {
    const area = containerHitArea(w, h, 0);
    expect(area).toMatchObject({ width: w, height: h });
    // -0 与 0 在数值上相等（Phaser 只做大小比较），这里不做 Object.is 级别的挑剔
    expect(area.x === 0).toBe(true);
    expect(area.y === 0).toBe(true);
  });

  it('中心、四边中点、四角都在可点区内（按视觉坐标相对按钮中心量）', () => {
    const area = containerHitArea(w, h, 0);
    const points: [number, number][] = [
      [0, 0], // 正中心 —— 旧写法在这里是闭区间边界，全靠"运气"
      [-w / 2, 0],
      [w / 2, 0],
      [0, -h / 2],
      [0, h / 2],
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [-w / 2, h / 2],
      [w / 2, h / 2],
    ];
    for (const [dx, dy] of points) {
      expect(containsAt(area, dx, dy, w, h), `(${dx}, ${dy}) 应该能点中`).toBe(true);
    }
  });

  it('旧的"直觉写法" (-w/2,-h/2,w,h) 点正中心是命中的，但点中心右侧/下方全部落空', () => {
    const legacy = { x: -w / 2, y: -h / 2, width: w, height: h };
    // 闭区间边界：正中心刚好压线，所以"偶尔点得中"
    expect(containsAt(legacy, 0, 0, w, h)).toBe(true);
    // 但按钮右半、下半完全点不动
    expect(containsAt(legacy, w / 4, 0, w, h)).toBe(false);
    expect(containsAt(legacy, 0, h / 4, w, h)).toBe(false);
    expect(containsAt(legacy, w / 4, h / 4, w, h)).toBe(false);
    expect(containsAt(legacy, -w / 4, -h / 4, w, h)).toBe(true); // 只有左上四分之一能用
  });

  it('默认外圈多给 TOUCH_PAD：点偏一点也算数，但不会无限外扩', () => {
    const area = containerHitArea(w, h);
    expect(TOUCH_PAD).toBeGreaterThan(0);
    expect(containsAt(area, w / 2 + TOUCH_PAD, 0, w, h)).toBe(true);
    expect(containsAt(area, 0, h / 2 + TOUCH_PAD, w, h)).toBe(true);
    expect(containsAt(area, -(w / 2 + TOUCH_PAD), -(h / 2 + TOUCH_PAD), w, h)).toBe(true);
    expect(containsAt(area, w / 2 + TOUCH_PAD + 1, 0, w, h)).toBe(false);
    expect(containsAt(area, 0, h / 2 + TOUCH_PAD + 1, w, h)).toBe(false);
  });

  it('典故卡两个按钮之间（336px 间距）不会被 TOUCH_PAD 粘在一起', () => {
    // 两个按钮中心相距 336，宽 288 → 视觉空隙 48，各外扩 12 之后还剩 24
    const gap = 336 - w;
    expect(gap - TOUCH_PAD * 2).toBeGreaterThan(0);
  });
});
