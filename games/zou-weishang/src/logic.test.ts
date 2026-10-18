// 走 '@chags/templates' 会把 Phaser 拉进来，而纯逻辑测试要能在 node 里直接跑
// —— 与既有游戏测试（如 shushang-kaihua）同一条规矩。
import { getEntry } from '@chags/content/full';
import type { TraceLevel } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import {
  advanceTrace, isTraceComplete, traceProgress, traceStart,
} from '@chags/templates/trace.logic';
import type { TraceCursor } from '@chags/templates/trace.logic';
import { ALLY_FLAGS, DUST, HOME_CAMP, POST_OFFSET, SAFE_CAMP, SHES, SKY_TOP } from './layout';
import { isRetreatComplete, retreatStops, stepsInLeg, traceLevel } from './logic';

const entry = getEntry('zou-weishang')!;
const level = traceLevel(entry);

/** 与 trace 场景的 autoplay 同一条路：沿锚点插值，逐点喂给真实判定 */
function walkLikeAutoplay(target: TraceLevel): { cursor: TraceCursor; stepped: number } {
  let cursor = traceStart();
  let stepped = 0;
  for (const segment of target.segments) {
    const stops = [
      segment.start,
      ...segment.anchors.map((anchor) => ({ x: anchor.x, y: anchor.y })),
      { x: segment.end.x, y: segment.end.y },
    ];
    for (let i = 1; i < stops.length; i += 1) {
      const from = stops[i - 1]!;
      const to = stops[i]!;
      const samples = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 80));
      for (let s = 1; s <= samples; s += 1) {
        const point = {
          x: from.x + ((to.x - from.x) * s) / samples,
          y: from.y + ((to.y - from.y) * s) / samples,
        };
        const before = cursor;
        cursor = advanceTrace(target, before, point);
        if (cursor !== before) stepped += 1;
      }
    }
  }
  return { cursor, stepped };
}

describe('走为上 · 三段退路：一舍一舍往后划', () => {
  it('正好三段：一舍、两舍、三舍，一段接一段', () => {
    expect(level.segments.map((segment) => segment.id)).toEqual(['she1', 'she2', 'she3']);
    expect(level.maxGap).toBe(200);
    // 十二个落脚点 = 3 段 ×（起点 + 2 锚点 + 终点）；其中第 2、3 段的起点就是上一段的终点，
    // 所以真正要划过去的是九步（见下面"按真实判定走一遍"）。
    expect(retreatStops(level)).toHaveLength(12);
    expect(retreatStops(level).filter((stop) => stop.kind === 'anchor')).toHaveLength(6);
    for (const segment of level.segments) {
      expect(segment.anchors.length).toBeGreaterThanOrEqual(2);
      expect(segment.anchors.length).toBeLessThanOrEqual(3);
      expect(stepsInLeg(segment)).toBe(segment.anchors.length + 1);
    }
  });

  it('每段两三个锚点，容差够手指粗的小朋友，而且都在画面里', () => {
    for (const segment of level.segments) {
      for (const anchor of segment.anchors) expect(anchor.radius).toBeGreaterThanOrEqual(60);
      expect(segment.end.radius).toBeGreaterThanOrEqual(60);
      const stops = [segment.start, ...segment.anchors, segment.end];
      for (const stop of stops) {
        expect(stop.x, segment.id + ' 的 x').toBeGreaterThan(40);
        expect(stop.x, segment.id + ' 的 x').toBeLessThan(710);
        expect(stop.y, segment.id + ' 的 y').toBeGreaterThan(200);
        expect(stop.y, segment.id + ' 的 y').toBeLessThan(1300);
      }
    }
  });

  it('上一段的终点就是下一段的起点 —— 一舍接一舍，退路才连得下去', () => {
    for (let i = 1; i < level.segments.length; i += 1) {
      const before = level.segments[i - 1]!;
      const after = level.segments[i]!;
      expect(Math.hypot(after.start.x - before.end.x, after.start.y - before.end.y)).toBeLessThan(40);
    }
  });

  it('一路往南退，不折返：每一段都往下走', () => {
    const stops = retreatStops(level);
    for (let i = 1; i < stops.length; i += 1) {
      expect(stops[i]!.y, stops[i]!.segment + ' 不能往回划').toBeGreaterThanOrEqual(stops[i - 1]!.y - 6);
    }
    expect(isRetreatComplete(level, 3)).toBe(true);
    expect(isRetreatComplete(level, 2)).toBe(false);
  });
});

describe('走为上 · 美术与关卡数据互锁', () => {
  it('三块里程碑就是三段的终点 —— 路标画在哪儿，判定就得在哪儿', () => {
    expect(level.segments).toHaveLength(SHES.length);
    for (const [index, segment] of level.segments.entries()) {
      expect(segment.end.x).toBe(SHES[index]!.x);
      expect(segment.end.y).toBe(SHES[index]!.y);
    }
    // 一舍比一舍远：三块里程碑一路往南
    expect(SHES[0]!.y).toBeLessThan(SHES[1]!.y);
    expect(SHES[1]!.y).toBeLessThan(SHES[2]!.y);
  });

  it('第三段退到城濮：终点就是城门，城门上有友军的旗', () => {
    const last = level.segments[level.segments.length - 1]!;
    expect(last.end.x).toBe(SAFE_CAMP.x);
    expect(last.end.y).toBe(SAFE_CAMP.y);
    expect(last.end.radius).toBe(SAFE_CAMP.radius);
    // 最后一舍是最南、也是唯一"有城墙有友军"的一站
    expect(SAFE_CAMP.y).toBeGreaterThan(SHES[0]!.y);
    for (const spot of ALLY_FLAGS) {
      expect(spot.y).toBeLessThan(SAFE_CAMP.y);
      expect(Math.hypot(spot.x - SAFE_CAMP.x, spot.y - SAFE_CAMP.y)).toBeLessThan(260);
    }
  });

  it('里程碑立在路的右边，压不到要划的那条路；追兵的尘土在北边', () => {
    const stops = retreatStops(level);
    for (const she of SHES.slice(0, -1)) {
      const postX = she.x + POST_OFFSET;
      for (const stop of stops) {
        expect(
          Math.hypot(stop.x - postX, stop.y - she.y),
          she.id + ' 的路标压在路上了',
        ).toBeGreaterThan(60);
      }
    }
    expect(POST_OFFSET).toBeGreaterThan(0);
    // 尘土在营地北边：退得越远，追兵离得越远
    expect(DUST.y).toBeLessThan(HOME_CAMP.y);
    expect(DUST.y).toBeGreaterThan(SKY_TOP);
  });
});

describe('走为上 · 判定：顺序、零惩罚、走得完', () => {
  it('按真实判定走一遍：三段依次划完，九步一步不少', () => {
    const { cursor, stepped } = walkLikeAutoplay(level);
    expect(stepped).toBe(9);
    expect(isTraceComplete(level, cursor)).toBe(true);
    expect(traceProgress(level, cursor)).toBe(1);
  });

  it('顺序不能跳：还没退到第二舍，去点第三舍的城门没有反应', () => {
    const start = traceStart();
    const gate = { x: level.segments[2]!.end.x, y: level.segments[2]!.end.y };
    expect(advanceTrace(level, start, gate)).toBe(start);
    expect(advanceTrace(level, start, { x: 60, y: 1200 })).toBe(start);
  });

  it('零惩罚：划歪了、划回去了，已经过的锚点一步都不会掉', () => {
    const first = level.segments[0]!;
    const anchor0 = first.anchors[0]!;
    const anchor1 = first.anchors[1]!;
    const afterFirst = advanceTrace(level, traceStart(), { x: anchor0.x, y: anchor0.y });
    expect(afterFirst).toEqual({ segment: 0, anchor: 1 });
    // 划歪：没推进
    expect(advanceTrace(level, afterFirst, { x: anchor1.x + 300, y: anchor1.y })).toBe(afterFirst);
    // 划回去：也不会退回去
    expect(advanceTrace(level, afterFirst, { x: anchor0.x, y: anchor0.y })).toBe(afterFirst);
    // 接着划到第二个锚点：照旧往前走
    expect(advanceTrace(level, afterFirst, { x: anchor1.x, y: anchor1.y })).toEqual({
      segment: 0,
      anchor: 2,
    });
  });
});

describe('走为上 · 故事与复习', () => {
  it('两幕：先"对面追上来了"，再"退到安全的地方" —— 关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择问"为什么要退三舍" —— 正解是既兑现承诺、又退到有城墙有友军的地方', () => {
    const options = entry.keyMoment.options;
    expect(options.filter((option) => option.isCanonical)).toHaveLength(1);
    const canonical = options.find((option) => option.isCanonical)!;
    expect(canonical.text).toContain('城濮');
    for (const option of options) {
      if (option.isCanonical) continue;
      // 另外两个选项不是"点了就错"，都要说清楚后果 —— 这条不在 zod schema 里，得留着
      expect(option.hint.length).toBeGreaterThan(0);
    }
    expect(entry.keyMoment.reveal).toContain('退');
  });

  it('三十六计的登记信息：第 36 计 · 败战计（第 6 套）；史源是《左传》僖公二十八年', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 36, set: 6 });
    expect(entry.dynasty).toBe('春秋');
    expect(entry.yearApprox).toBe(-632);
    expect(entry.figures).toContain('晋文公');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《左传·僖公二十八年》');
    expect(entry.source.quote).toBe('退三舍辟之，所以报也。');
    expect(entry.moral).toContain('退');
    expect(entry.game.template).toBe('trace');
    expect(entry.game.stages[0]!.template).toBe('trace');
  });

  it('复习题：记忆题问"一舍多远""城濮是什么地方"，迁移题落在"先离开不利的地方"', () => {
    const transfer = entry.quiz.find((question) => question.kind === 'transfer')!;
    expect(transfer.question).toContain('走为上');
    expect(transfer.explanation).toContain('不是认输');
  });

  it('儿童化：退是保住人和东西，不是认输 —— 也没有一处流血', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation + question.options.join('')),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '伤', '交战']) expect(prose).not.toContain(word);
    expect(prose).toContain('退');
    expect(prose).toContain('保住');
  });
});

describe('走为上 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('zou-weishang', 'en')!;
    expect(merged.title).toBe('Retreat Is the Best Course');
    expect(merged.game.stages[0]!.levelScript).toMatchObject({ hint: 'Drag on, march by march' });
  });
});
