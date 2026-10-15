import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { sortLevel } from './logic';

describe('神农尝百草 · 关卡数据', () => {
  const level = sortLevel(getEntry('shennong')!);

  it('三块木牍 + 八株草，一块不多一块不少', () => {
    expect(level.bins.length).toBe(3);
    expect(level.items.length).toBe(8);
    // 每一类都得有：尝过之后，三块木牍上都要有东西
    for (const bin of level.bins) {
      expect(level.items.filter((i) => i.binId === bin.id).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('每块木牍都有东西可放 —— 不然孩子会盯着一块空木牍发呆', () => {
    for (const bin of level.bins) {
      expect(level.items.filter((i) => i.binId === bin.id).length).toBeGreaterThan(0);
    }
  });

  it('先尝后分：嘴边和每株草的 tastedKind 都得写清楚', () => {
    expect(level.probe).toBeTruthy();
    for (const item of level.items) {
      expect(item.tastedKind, item.id + ' 没有尝过之后的样子').toBeTruthy();
      expect(['food', 'cure', 'poison']).toContain(item.tastedKind);
    }
  });

  it('每株草都有一句归位时说的话（用听不用看）', () => {
    for (const item of level.items) expect(item.speak).toBeTruthy();
  });

  it('东西都摆在画里，不会被木牍压住', () => {
    for (const item of level.items) {
      expect(item.x).toBeGreaterThan(80);
      expect(item.x).toBeLessThan(670);
      expect(item.y).toBeLessThan(900);
    }
    for (const bin of level.bins) {
      expect(bin.y).toBeGreaterThan(1000);
    }
  });

  it('草的种类互不相同 —— 孩子靠形状分辨它们', () => {
    const kinds = level.items.map((i) => i.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
