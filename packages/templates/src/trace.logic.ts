import type { TraceAnchor, TraceLevel, TraceSegment } from './schemas';

export interface TracePoint {
  x: number;
  y: number;
}

/** 划到哪儿了：第几段、这一段过了几个锚点 */
export interface TraceCursor {
  segment: number;
  anchor: number;
}

export function traceStart(): TraceCursor {
  return { segment: 0, anchor: 0 };
}

export function currentSegment(level: TraceLevel, cursor: TraceCursor): TraceSegment | undefined {
  return level.segments[cursor.segment];
}

/** 下一个要过的锚点；已经过完了就是 undefined（该往终点划了） */
export function currentAnchor(level: TraceLevel, cursor: TraceCursor): TraceAnchor | undefined {
  const segment = currentSegment(level, cursor);
  return segment?.anchors[cursor.anchor];
}

/** 现在该往哪儿划：下一个锚点，或者这一段的终点 */
export function currentTarget(
  level: TraceLevel,
  cursor: TraceCursor,
): { x: number; y: number; radius: number } | undefined {
  const segment = currentSegment(level, cursor);
  if (!segment) return undefined;
  const anchor = segment.anchors[cursor.anchor];
  return anchor ?? segment.end;
}

/**
 * 往前推进一格 —— **只前进，不后退**：
 * 划歪了、划回去了都不会把已经过的锚点退掉，孩子不会因为手抖丢进度。
 *
 * prev 用来挡"瞬移"（手指抬起后落在别处，不该算一条河道），
 * 但它只是防作弊，不是精度要求：同一笔里慢机器的稀疏采样也照样能过。
 */
export function advanceTrace(
  level: TraceLevel,
  cursor: TraceCursor,
  point: TracePoint,
  prev?: TracePoint,
): TraceCursor {
  const segment = currentSegment(level, cursor);
  if (!segment) return cursor;
  if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) > level.maxGap) return cursor;

  const target = currentTarget(level, cursor);
  if (!target) return cursor;
  if (Math.hypot(point.x - target.x, point.y - target.y) > target.radius) return cursor;

  if (cursor.anchor < segment.anchors.length) {
    return { segment: cursor.segment, anchor: cursor.anchor + 1 };
  }
  return { segment: cursor.segment + 1, anchor: 0 };
}

/** 每一段要走几步：锚点数 + 终点 */
function stepsIn(segment: TraceSegment): number {
  return segment.anchors.length + 1;
}

/** 已经走了几步（跨段累计） */
function stepsDone(level: TraceLevel, cursor: TraceCursor): number {
  let done = 0;
  for (let i = 0; i < Math.min(cursor.segment, level.segments.length); i += 1) {
    done += stepsIn(level.segments[i]!);
  }
  if (cursor.segment < level.segments.length) done += cursor.anchor;
  return done;
}

export function isTraceComplete(level: TraceLevel, cursor: TraceCursor): boolean {
  return cursor.segment >= level.segments.length;
}

export function traceProgress(level: TraceLevel, cursor: TraceCursor): number {
  const total = level.segments.reduce((sum, segment) => sum + stepsIn(segment), 0);
  return total === 0 ? 1 : Math.min(1, stepsDone(level, cursor) / total);
}

/** 这一段是不是刚好划完（用来触发"水退了"的演出） */
export function justFinishedSegment(before: TraceCursor, after: TraceCursor): number | null {
  return after.segment > before.segment ? before.segment : null;
}
