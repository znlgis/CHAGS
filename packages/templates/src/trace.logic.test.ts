import { describe, expect, it } from 'vitest';
import { TraceLevelSchema } from './schemas';
import {
  advanceTrace, currentAnchor, currentTarget, isTraceComplete, traceProgress, traceStart,
} from './trace.logic';

const level = TraceLevelSchema.parse({
  segments: [
    {
      id: 'one',
      start: { x: 100, y: 900 },
      anchors: [
        { id: 'a1', x: 300, y: 800, radius: 60 },
        { id: 'a2', x: 500, y: 700, radius: 60 },
      ],
      end: { x: 680, y: 600, radius: 70 },
    },
    {
      id: 'two',
      start: { x: 680, y: 600 },
      anchors: [{ id: 'b1', x: 500, y: 400, radius: 60 }],
      end: { x: 300, y: 250, radius: 70 },
    },
  ],
  hint: '从水口往下划',
});

describe('往前推进', () => {
  it('按顺序经过锚点，再到终点，这一才算通', () => {
    let cursor = traceStart();
    expect(currentAnchor(level, cursor)?.id).toBe('a1');
    cursor = advanceTrace(level, cursor, { x: 300, y: 810 });
    expect(cursor).toEqual({ segment: 0, anchor: 1 });
    cursor = advanceTrace(level, cursor, { x: 505, y: 705 });
    expect(currentTarget(level, cursor)).toMatchObject({ x: 680, y: 600 });
    cursor = advanceTrace(level, cursor, { x: 675, y: 610 });
    expect(cursor).toEqual({ segment: 1, anchor: 0 });
  });

  it('越序不算数：先到第二个锚点，进度不动', () => {
    const cursor = advanceTrace(level, traceStart(), { x: 500, y: 700 });
    expect(cursor).toEqual({ segment: 0, anchor: 0 });
  });

  it('划歪了不倒退：已经过的锚点会留着', () => {
    let cursor = advanceTrace(level, traceStart(), { x: 300, y: 800 });
    cursor = advanceTrace(level, cursor, { x: 120, y: 1200 });
    expect(cursor).toEqual({ segment: 0, anchor: 1 });
  });

  it('瞬移不许过（手指抬起来落在别处，不算一条河道）', () => {
    const prev = { x: 100, y: 900 };
    const cursor = advanceTrace(level, traceStart(), { x: 300, y: 800 }, prev);
    expect(cursor).toEqual({ segment: 0, anchor: 0 });
  });

  it('慢机器上的稀疏采样照样能过（只要是一笔划下来的）', () => {
    const prev = { x: 200, y: 870 };
    const cursor = advanceTrace(level, traceStart(), { x: 300, y: 800 }, prev);
    expect(cursor).toEqual({ segment: 0, anchor: 1 });
  });

  it('全部划完就是完成', () => {
    let cursor = traceStart();
    for (const point of [
      { x: 300, y: 800 }, { x: 500, y: 700 }, { x: 680, y: 600 },
      { x: 500, y: 400 }, { x: 300, y: 250 },
    ]) {
      cursor = advanceTrace(level, cursor, point);
    }
    expect(isTraceComplete(level, cursor)).toBe(true);
    expect(traceProgress(level, cursor)).toBe(1);
  });
});

describe('进度', () => {
  it('只增不减，而且到不了 1 之前都不算完成', () => {
    const a = traceProgress(level, traceStart());
    const b = traceProgress(level, { segment: 0, anchor: 2 });
    const c = traceProgress(level, { segment: 1, anchor: 1 });
    expect(a).toBe(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(1);
  });

  it('没有锚点的段（只有起点和终点）也能算', () => {
    const simple = TraceLevelSchema.parse({
      segments: [{ id: 's', start: { x: 0, y: 0 }, anchors: [], end: { x: 100, y: 0, radius: 50 } }],
      hint: '划过去',
    });
    expect(simple.segments[0]!.anchors.length).toBe(0);
    expect(traceProgress(simple, traceStart())).toBe(0);
    expect(traceProgress(simple, { segment: 1, anchor: 0 })).toBe(1);
  });
});
