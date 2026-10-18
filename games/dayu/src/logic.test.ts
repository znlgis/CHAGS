import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { tapLevel, traceLevel } from './logic';

const content = getEntry('dayu')!;
const tap = tapLevel(content);
const trace = traceLevel(content);

describe('大禹治水 · 关卡数据', () => {
  it('两段脚本都在：先堵（tap），后疏（trace）', () => {
    expect(content.game.stages.map((s) => s.template)).toEqual(['tap', 'trace']);
    expect(content.game.template).toBe('trace');
  });

  it('堵：十四筐土正好把堤点满，一筐都不多', () => {
    expect(tap.mode).toBe('tap');
    expect(tap.unit).toBe('筐');
    expect(tap.targetValue).toBe(14);
    expect(Number.isInteger(tap.targetValue / tap.stepValue)).toBe(true);
    expect(tap.targetValue / tap.stepValue).toBe(14);
  });

  it('堵：筑堤的手感是"使点劲"，没有里程碑干扰', () => {
    expect(tap.resistance).toBeGreaterThan(0);
    expect(tap.resistance).toBeLessThanOrEqual(1);
    expect(tap.milestones).toEqual([]);
  });

  it('疏：三段，按开沟 → 劈山 → 入海的顺序', () => {
    expect(trace.segments.map((s) => s.id)).toEqual(['ditch', 'mountain', 'sea']);
  });

  it('疏：每段四个锚点 + 一个终点，容差够手指粗的小朋友', () => {
    for (const segment of trace.segments) {
      expect(segment.anchors.length, segment.id + ' 的锚点数').toBe(4);
      for (const anchor of segment.anchors) expect(anchor.radius).toBeGreaterThanOrEqual(60);
      expect(segment.end.radius).toBeGreaterThanOrEqual(60);
    }
  });

  it('疏：所有点位都在画面里，不会划到屏幕外', () => {
    for (const segment of trace.segments) {
      const stops = [segment.start, ...segment.anchors, segment.end];
      for (const stop of stops) {
        expect(stop.x, segment.id + ' 的 x').toBeGreaterThan(40);
        expect(stop.x, segment.id + ' 的 x').toBeLessThan(710);
        expect(stop.y, segment.id + ' 的 y').toBeGreaterThan(200);
        expect(stop.y, segment.id + ' 的 y').toBeLessThan(1300);
      }
    }
  });

  it('疏：上一段的终点就是下一段的起点 —— 水才连得下去', () => {
    for (let i = 1; i < trace.segments.length; i += 1) {
      const before = trace.segments[i - 1]!;
      const after = trace.segments[i]!;
      expect(Math.hypot(after.start.x - before.end.x, after.start.y - before.end.y)).toBeLessThan(40);
    }
  });

  it('疏：一路往下流，不折返', () => {
    for (const segment of trace.segments) {
      const stops = [segment.start, ...segment.anchors, segment.end];
      for (let i = 1; i < stops.length; i += 1) {
        expect(stops[i]!.y, segment.id + ' 不能往回划').toBeGreaterThanOrEqual(stops[i - 1]!.y - 6);
      }
    }
  });

  it('疏：第二段从山口穿过，第三段把水送进大海', () => {
    const mountain = trace.segments[1]!;
    for (const anchor of mountain.anchors) {
      expect(Math.abs(anchor.x - 375), '水要从龙门山的山口出去').toBeLessThanOrEqual(40);
    }
    expect(trace.segments[2]!.end.y).toBeGreaterThanOrEqual(1100);
  });
});
