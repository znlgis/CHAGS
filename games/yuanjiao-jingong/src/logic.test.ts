import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  expectedNext, isOrderDone, neighborAt, nextIdInOrder, noteWrongPick, orderProgress,
  orderStart, pick, pickedCount, pickedOrder, wrongPicks,
} from '@chags/templates/matchup.logic';
import { CAPITAL, FAR_RING, NEAR_RING, NEIGHBORS, NEIGHBOR_RADIUS } from './layout';
import { matchupLevel } from './logic';

const entry = getEntry('yuanjiao-jingong')!;
const level = matchupLevel(entry);

/** 一座城到秦都（地图中央）的距离 —— 近的一圈 / 远的一圈按它分 */
function distanceOf(id: string): number {
  const neighbor = level.neighbors.find((item) => item.id === id)!;
  return Math.hypot(neighbor.x - CAPITAL.x, neighbor.y - CAPITAL.y);
}

/** 按 sequence 一路点过去 —— 与场景的 pressAt 走的是同一条判定 */
function walkOrder() {
  let state = orderStart(level);
  for (const id of level.sequence) state = pick(state, id);
  return state;
}

describe('远交近攻 · 关卡数据', () => {
  it('matchup · order：一圈六个势力，按 sequence 点过去', () => {
    expect(level.mode).toBe('order');
    expect(level.neighbors.length).toBe(6);
    expect(level.sequence).toEqual(['han', 'wei', 'zhao', 'chu', 'yan', 'qi']);
    for (const neighbor of level.neighbors) expect(neighbor.label.length).toBeLessThanOrEqual(12);
  });

  it('近的三个要处理（attack）、远的三个先结好（ally）', () => {
    const attacks = level.neighbors.filter((item) => item.stance === 'attack').map((item) => item.id);
    const allies = level.neighbors.filter((item) => item.stance === 'ally').map((item) => item.id);
    expect(attacks.sort()).toEqual(['han', 'wei', 'zhao']);
    expect(allies.sort()).toEqual(['chu', 'qi', 'yan']);
    expect(level.neighbors.map((item) => item.label)).toEqual(['韩', '魏', '赵', '楚', '燕', '齐']);
  });

  it('美术画在哪儿，关卡数据就得在哪儿：六座城一字不差', () => {
    expect(level.neighbors.map((item) => [item.id, item.x, item.y])).toEqual(
      NEIGHBORS.map((item) => [item.id, item.x, item.y]),
    );
    for (const neighbor of level.neighbors) expect(neighbor.radius).toBe(NEIGHBOR_RADIUS);
  });

  it('近的都在内圈、远的都在外圈：两圈之间留得下空地', () => {
    for (const neighbor of level.neighbors) {
      const d = distanceOf(neighbor.id);
      if (neighbor.stance === 'attack') {
        expect(d, neighbor.id + ' 落在内圈').toBeGreaterThanOrEqual(NEAR_RING.min);
        expect(d, neighbor.id + ' 落在内圈').toBeLessThanOrEqual(NEAR_RING.max);
      } else {
        expect(d, neighbor.id + ' 落在外圈').toBeGreaterThanOrEqual(FAR_RING.min);
        expect(d, neighbor.id + ' 落在外圈').toBeLessThanOrEqual(FAR_RING.max);
      }
    }
    // 最近的"远的"也比最远的"近的"远 —— 近远一眼看得出来
    const near = level.neighbors.filter((item) => item.stance === 'attack').map((item) => distanceOf(item.id));
    const far = level.neighbors.filter((item) => item.stance === 'ally').map((item) => distanceOf(item.id));
    expect(Math.max(...near)).toBeLessThan(Math.min(...far));
  });

  it('六座城彼此离得够开，也都在画面里', () => {
    for (let i = 0; i < level.neighbors.length; i += 1) {
      for (let k = i + 1; k < level.neighbors.length; k += 1) {
        const a = level.neighbors[i]!;
        const b = level.neighbors[k]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.radius + b.radius);
        expect(gap, a.id + ' 与 ' + b.id + ' 挨在一起了').toBeGreaterThan(40);
      }
    }
    for (const neighbor of level.neighbors) {
      expect(neighbor.x - neighbor.radius).toBeGreaterThanOrEqual(0);
      expect(neighbor.x + neighbor.radius).toBeLessThanOrEqual(750);
      expect(neighbor.y - neighbor.radius).toBeGreaterThan(150);
      expect(neighbor.y + neighbor.radius).toBeLessThanOrEqual(1334);
    }
    // 秦都在正中间，比哪一座城都大
    expect(CAPITAL.radius).toBeGreaterThan(NEIGHBOR_RADIUS);
  });
});

describe('远交近攻 · 判定：顺序就是"近的先解决，远的先结好"', () => {
  it('近的从近到远：韩 → 魏 → 赵', () => {
    const near = ['han', 'wei', 'zhao'].map(distanceOf);
    expect(near[0]).toBeLessThan(near[1]!);
    expect(near[1]).toBeLessThan(near[2]!);
    expect(level.sequence.slice(0, 3)).toEqual(['han', 'wei', 'zhao']);
  });

  it('远的从远到近：楚 → 燕 → 齐', () => {
    const far = ['chu', 'yan', 'qi'].map(distanceOf);
    expect(far[0]).toBeGreaterThan(far[1]!);
    expect(far[1]).toBeGreaterThan(far[2]!);
    expect(level.sequence.slice(3)).toEqual(['chu', 'yan', 'qi']);
  });

  it('下一个该点谁：从 sequence 的第一个开始；点完了就没有下一个', () => {
    let state = orderStart(level);
    expect(nextIdInOrder(state)).toBe('han');
    expect(expectedNext(level, state)?.label).toBe('韩');
    state = walkOrder();
    expect(nextIdInOrder(state)).toBeUndefined();
    expect(expectedNext(level, state)).toBeUndefined();
    expect(isOrderDone(level, state)).toBe(true);
    expect(pickedOrder(state)).toEqual(level.sequence);
  });

  it('一局真的走得完：按 sequence 一个一个点，点完就成', () => {
    const state = walkOrder();
    expect(pickedCount(state)).toBe(6);
    expect(orderProgress(level, state)).toBe(1);
    expect(wrongPicks(state)).toBe(0);
    expect(level.hint).toBe('近的先解决，远的先结好');
  });

  it('点错了原样返回 —— 零惩罚，顺序可以重排', () => {
    const state = orderStart(level);
    expect(pick(state, 'qi')).toBe(state);
    expect(pick(state, 'zhao')).toBe(state);
    expect(pickedCount(state)).toBe(0);
    // 点错之后照样能接着按正确顺序走
    const next = pick(state, 'han');
    expect(expectedNext(level, next)?.id).toBe('wei');
  });

  it('点错只记一笔（复盘用）：不扣星、不结束，已经点对的留着', () => {
    let state = pick(pick(orderStart(level), 'han'), 'wei');
    state = noteWrongPick(state); // 该点赵，点了楚 —— 场景这么记
    expect(wrongPicks(state)).toBe(1);
    expect(pickedOrder(state)).toEqual(['han', 'wei']);
    expect(expectedNext(level, state)?.id).toBe('zhao');
    // 后面接着点完，错的那一次只是记着
    for (const id of ['zhao', 'chu', 'yan', 'qi']) state = pick(state, id);
    expect(isOrderDone(level, state)).toBe(true);
    expect(wrongPicks(state)).toBe(1);
    // 点完了再点谁都不动（零惩罚）
    expect(pick(state, 'han')).toBe(state);
  });
});

describe('远交近攻 · 手指粗也点得到（点空是零惩罚的）', () => {
  it('按半径算命中；点在秦都上、点在地图空白处都不算', () => {
    for (const neighbor of level.neighbors) {
      expect(neighborAt(level, neighbor.x, neighbor.y, 0)?.id).toBe(neighbor.id);
    }
    expect(neighborAt(level, CAPITAL.x, CAPITAL.y, 0)).toBeUndefined();
    expect(neighborAt(level, 375, 880, 0)).toBeUndefined();
    // 给一点宽容度就能点到：小朋友不用对准
    expect(neighborAt(level, 375, 1010 + 90, 46)?.id).toBe('han');
    expect(neighborAt(level, 375, 1010 + 90, 0)).toBeUndefined();
  });

  it('离得近时拿最近的那一个', () => {
    expect(neighborAt(level, 250, 760, 200)?.id).toBe('wei');
  });
});

describe('远交近攻 · 故事与复习', () => {
  it('两幕：范雎献计 → 秦国照这个顺序一步步往外走', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.story[0]!.text).toContain('远');
  });

  it('三十六计：第 23 计 · 混战计（第 4 套），史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 23, set: 4 });
    expect(entry.source.book).toBe('《三十六计·混战计》');
    expect(entry.source.chapter).toBe('远交近攻');
    expect(entry.source.quote).toContain('利从近取');
    expect(entry.yearApprox).toBe(-270);
    expect(entry.figures).toEqual(['范雎', '秦昭王']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.game.template).toBe('matchup');
    expect(entry.game.stages[0]!.template).toBe('matchup');
  });

  it('关键抉择点恰好一个"先跟远的交好，再处理近的"', () => {
    const options = entry.keyMoment.options;
    expect(options.find((option) => option.isCanonical)?.text).toContain('远');
    expect(entry.keyMoment.reveal).toContain('先');
  });

  it('复习题：记忆题问先跟谁交好，迁移题问两个任务先做哪个', () => {
    const transfer = entry.quiz.find((question) => question.kind === 'transfer');
    expect(transfer?.question).toContain('听写');
  });

  it('儿童化：地图上只有结盟与处理，没有一处交战与流血', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
    ].join('');
    for (const word of ['血', '死', '杀', '伤']) expect(prose).not.toContain(word);
  });
});

describe('远交近攻 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('yuanjiao-jingong', 'en')!;
    expect(merged.title).toBe('Befriend the Far, Attack the Near');
  });
});
