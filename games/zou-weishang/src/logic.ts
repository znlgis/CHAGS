import type { ContentEntry } from '@chags/content';
import { stageScript } from '@chags/content';
import { TraceLevelSchema } from '@chags/templates/schemas';
import type { TraceLevel, TraceSegment } from '@chags/templates/schemas';

/** 纯逻辑：不碰 Phaser，可以直接单测 */
export function traceLevel(content: ContentEntry): TraceLevel {
  return TraceLevelSchema.parse(stageScript(content, 'trace'));
}

/** 退路上的一个落脚点：一段路的起点、一个锚点，或者这一段的终点 */
export interface RetreatStop {
  /** 属于哪一段 */
  segment: string;
  kind: 'start' | 'anchor' | 'end';
  x: number;
  y: number;
}

/**
 * 整条退路摊平成一个落脚点串：一段一段往下接。
 *
 * 三件事共用这一串：小手提示要停哪儿、路标刻痕该刻几道、单测检查
 * "上一段的终点就是下一段的起点"。
 */
export function retreatStops(level: TraceLevel): RetreatStop[] {
  const stops: RetreatStop[] = [];
  for (const segment of level.segments) {
    stops.push({ segment: segment.id, kind: 'start', x: segment.start.x, y: segment.start.y });
    for (const anchor of segment.anchors) {
      stops.push({ segment: segment.id, kind: 'anchor', x: anchor.x, y: anchor.y });
    }
    stops.push({ segment: segment.id, kind: 'end', x: segment.end.x, y: segment.end.y });
  }
  return stops;
}

/** 一舍要走几步：几个锚点，再加终点那一步 */
export function stepsInLeg(segment: TraceSegment): number {
  return segment.anchors.length + 1;
}

/** 退满三舍了吗（三段都划完了）—— 安全的地方到了 */
export function isRetreatComplete(level: TraceLevel, legsDone: number): boolean {
  return legsDone >= level.segments.length;
}
