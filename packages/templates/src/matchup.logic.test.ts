import { describe, expect, it } from 'vitest';
import { MatchupLevelSchema, MatchupOrderLevelSchema, bestMatchupWins } from './schemas';
import type { MatchupNeighbor } from './schemas';
import {
  MATCHUP_ORDER_TIMING, MATCHUP_TIMING, assign, bestRoster, bestWins, expectedNext, horseAtSlot,
  horseNear, isMatchupDone, isOrderDone, isRosterFull, lossesFor, matchupProgress, neighborAt,
  neighborsInOrder, nextIdInOrder, noteWrongPick, orderProgress, orderStart, pairings, pick,
  pickedCount, pickedOrder, placements, resetRoster, resolve, rivalAt, scaledMs, slotOfHorse,
  takeBack, winsFor, winsNeeded, wrongPicks,
} from './matchup.logic';

/**
 * 第 11 计 · 李代桃僵：田忌赛马。
 * 三匹马 6 / 5 / 4，三场对手 7 / 5 / 3 —— 硬碰硬只赢一场，错开排能赢两场。
 */
const level = MatchupLevelSchema.parse({
  mode: 'pair',
  horses: [
    { id: 'top', rank: 'top', power: 6, x: 180, y: 1060, radius: 78 },
    { id: 'mid', rank: 'mid', power: 5, x: 375, y: 1060, radius: 78 },
    { id: 'low', rank: 'low', power: 4, x: 570, y: 1060, radius: 78 },
  ],
  rivals: [
    { id: 'r1', power: 7, x: 592, y: 622, label: '上等马' },
    { id: 'r2', power: 5, x: 592, y: 812, label: '中等马' },
    { id: 'r3', power: 3, x: 592, y: 1002, label: '下等马' },
  ],
  needWins: 2,
  hint: '三局两胜：赢哪两场要想好',
});

/** 下对上 / 上对中 / 中对下 —— 孙膑那三句话 */
const sunBin: number[] = [2, 0, 1];
/** 上对上 / 中对中 / 下对下 —— 硬碰硬 */
const headOn: number[] = [0, 1, 2];

describe('每一场的输赢：power 大者胜，相等算输', () => {
  it('孙膑的排法：下对上输、上对中赢、中对下赢 —— 正好两胜', () => {
    const races = resolve(level, sunBin);
    expect(races.map((race) => race.horseId)).toEqual(['low', 'top', 'mid']);
    expect(races.map((race) => race.rivalId)).toEqual(['r1', 'r2', 'r3']);
    expect(races.map((race) => race.win)).toEqual([false, true, true]);
    expect(winsFor(level, sunBin)).toBe(2);
    expect(lossesFor(level, sunBin)).toBe(1);
  });

  it('硬碰硬：只有上对下那一场赢（上对上 6<7 输、中对中 5=5 平）', () => {
    expect(resolve(level, headOn).map((race) => race.win)).toEqual([false, false, true]);
    expect(winsFor(level, headOn)).toBe(1);
    expect(lossesFor(level, headOn)).toBe(2);
  });

  it('power 相等算输：5 对 5 不算赢（没有"侥幸赢"）', () => {
    // mid（5）对上 r2（5）：平局判负
    expect(resolve(level, [2, 1, 0])[1]).toMatchObject({ horseId: 'mid', rivalId: 'r2', win: false });
    // top（6）对上 r2（5）才算赢
    expect(resolve(level, [2, 0, 1])[1]).toMatchObject({ horseId: 'top', win: true });
  });

  it('没排满的那几场不算赢（还没开赛就不能算分）', () => {
    expect(winsFor(level, [0])).toBe(0);
    expect(winsFor(level, [])).toBe(0);
    expect(resolve(level, [0])[0]).toMatchObject({ horseId: 'top', win: false });
    expect(resolve(level, [0])[1]).toMatchObject({ horseId: '', win: false });
  });
});

describe('六种配对全枚举', () => {
  it('3! = 6 种，每一种都是三个互不相同的下标', () => {
    const all = pairings(level);
    expect(all.length).toBe(6);
    for (const roster of all) {
      expect([...roster].sort()).toEqual([0, 1, 2]);
    }
  });

  it('六种排法赢的场次：只有两种排法赢得下两场（这就是"排法决定胜负"）', () => {
    const wins = pairings(level).map((roster) => winsFor(level, roster));
    expect(wins.filter((count) => count === 2).length).toBe(2);
    expect(wins).not.toContain(3);
    expect(wins.every((count) => count >= 1)).toBe(true);
    expect(Math.max(...pairings(level).map((roster) => winsFor(level, roster)))).toBe(2);
  });

  it('bestRoster 的胜场 = schemas 的 bestMatchupWins（构建期与玩法同一个答案）', () => {
    const roster = bestRoster(level);
    expect(winsFor(level, roster)).toBe(2);
    expect(winsFor(level, roster)).toBe(bestWins(level));
    expect(bestWins(level)).toBe(bestMatchupWins(level.horses, level.rivals));
    // 也等于"六种排法里最好的那一种"
    expect(bestWins(level)).toBe(Math.max(...pairings(level).map((r) => winsFor(level, r))));
  });

  it('bestRoster 是一种合法排法，而且它真的能赢整场', () => {
    const roster = bestRoster(level);
    expect(isRosterFull(level, roster)).toBe(true);
    expect([...roster].sort()).toEqual([0, 1, 2]);
    expect(isMatchupDone(level, winsFor(level, roster))).toBe(true);
    // 只返回副本：改它不会污染关卡数据
    roster[0] = 99;
    expect(bestRoster(level)).not.toContain(99);
  });
});

describe('赢几场算胜', () => {
  it('needWins = 2：赢两场就成，赢一场不算', () => {
    expect(isMatchupDone(level, 0)).toBe(false);
    expect(isMatchupDone(level, 1)).toBe(false);
    expect(isMatchupDone(level, 2)).toBe(true);
    expect(isMatchupDone(level, 3)).toBe(true);
    expect(winsNeeded(level, 1)).toBe(1);
    expect(winsNeeded(level, 2)).toBe(0);
    expect(matchupProgress(level, 1)).toBe(0.5);
    expect(matchupProgress(level, 2)).toBe(1);
  });

  it('整关验算：硬碰硬只有一胜 → 未完成；错开排两胜 → 完成', () => {
    expect(isMatchupDone(level, winsFor(level, headOn))).toBe(false);
    expect(isMatchupDone(level, winsFor(level, sunBin))).toBe(true);
  });
});

describe('排兵：随便改，零惩罚', () => {
  it('开局三场都空着，一匹马都不在场上', () => {
    const empty = resetRoster(level);
    expect(empty).toEqual([-1, -1, -1]);
    expect(isRosterFull(level, empty)).toBe(false);
    expect(horseAtSlot(level, empty, 0)).toBeUndefined();
    expect(slotOfHorse(level, empty, 'top')).toBe(-1);
    expect(winsFor(level, empty)).toBe(0);
  });

  it('把马放到第几场；空位自动补 -1', () => {
    let roster = resetRoster(level);
    roster = assign(level, roster, 1, 'top');
    expect(roster).toEqual([-1, 0, -1]);
    expect(horseAtSlot(level, roster, 1)?.id).toBe('top');
    expect(slotOfHorse(level, roster, 'top')).toBe(1);
    roster = assign(level, roster, 0, 'low');
    roster = assign(level, roster, 2, 'mid');
    expect(roster).toEqual([2, 0, 1]);
    expect(isRosterFull(level, roster)).toBe(true);
    expect(winsFor(level, roster)).toBe(2);
  });

  it('把已经在场上的马放到别场：两匹马换位置，不会凭空多出一匹', () => {
    let roster = assign(level, assign(level, assign(level, resetRoster(level), 0, 'top'), 1, 'mid'), 2, 'low');
    expect(roster).toEqual([0, 1, 2]);
    // 把 1 号场的 mid 挪到 0 号场：top 换到 1 号场
    roster = assign(level, roster, 0, 'mid');
    expect(roster).toEqual([1, 0, 2]);
    expect(slotOfHorse(level, roster, 'mid')).toBe(0);
    expect(slotOfHorse(level, roster, 'top')).toBe(1);
    expect(isRosterFull(level, roster)).toBe(true);
  });

  it('输了就放回架子再来 —— 这一步永远是免费的', () => {
    let roster = assign(level, assign(level, assign(level, resetRoster(level), 0, 'top'), 1, 'mid'), 2, 'low');
    expect(winsFor(level, roster)).toBe(1);
    expect(isMatchupDone(level, winsFor(level, roster))).toBe(false);
    // 把上等马从第 1 场放回架子：有三场没排好，场面还是 1 胜
    roster = takeBack(level, roster, 0);
    expect(horseAtSlot(level, roster, 0)).toBeUndefined();
    expect(slotOfHorse(level, roster, 'top')).toBe(-1);
    expect(roster).toEqual([-1, 1, 2]);
    expect(isRosterFull(level, roster)).toBe(false);
    expect(winsFor(level, roster)).toBe(1);
    // 重新排：下等马对他的上等马（故意舍一局），其余两场换回来
    roster = assign(level, roster, 0, 'low');
    expect(roster).toEqual([2, 1, -1]);
    expect(horseAtSlot(level, roster, 0)?.id).toBe('low');
    expect(slotOfHorse(level, roster, 'low')).toBe(0);
    // 上等马进第 2 场：它原来站的第 3 场就空出来了（中等马放回架子）
    roster = assign(level, roster, 1, 'top');
    expect(roster).toEqual([2, 0, -1]);
    expect(isRosterFull(level, roster)).toBe(false);
    // 中等马进第 3 场 —— 三场排满
    roster = assign(level, roster, 2, 'mid');
    expect(roster).toEqual([2, 0, 1]);
    expect(isRosterFull(level, roster)).toBe(true);
    expect([...roster].sort()).toEqual([0, 1, 2]);
    expect(horseAtSlot(level, roster, 0)?.id).toBe('low');
    expect(horseAtSlot(level, roster, 1)?.id).toBe('top');
    expect(horseAtSlot(level, roster, 2)?.id).toBe('mid');
    expect(winsFor(level, roster)).toBe(2);
    expect(isMatchupDone(level, winsFor(level, roster))).toBe(true);
    // 全程没有惩罚：输过、重排过，赢的时候还是"两胜"，不多不少
    expect(lossesFor(level, roster)).toBe(1);
  });

  it('排错也不会卡住：不存在的马、越界的场次都只是原样返回', () => {
    const roster = resetRoster(level);
    expect(assign(level, roster, 0, 'ghost')).toEqual([-1, -1, -1]);
    expect(assign(level, roster, 5, 'top')).toEqual([-1, -1, -1]);
    expect(assign(level, roster, -1, 'top')).toEqual([-1, -1, -1]);
    for (const next of [assign(level, roster, 5, 'top'), takeBack(level, roster, 9)]) {
      expect(next.length).toBe(level.rivals.length);
      expect(next.every((index) => index === -1)).toBe(true);
    }
  });

  it('当时排下的马不会因为"重置"以外的事掉出去', () => {
    const roster = assign(level, assign(level, assign(level, resetRoster(level), 0, 'low'), 1, 'top'), 2, 'mid');
    expect(placements(level, roster)).toEqual([
      { slot: 0, horse: level.horses[2]! },
      { slot: 1, horse: level.horses[0]! },
      { slot: 2, horse: level.horses[1]! },
    ]);
  });
});

describe('点选：手指粗也能点得到', () => {
  it('点自己的马：按半径算，点空就是没点到', () => {
    expect(horseNear(level, 180, 1060, 0)?.id).toBe('top');
    expect(horseNear(level, 570, 1060, 0)?.id).toBe('low');
    expect(horseNear(level, 375, 400, 0)).toBeUndefined();
    expect(horseNear(level, 180, 1060 + 110, 44)?.id).toBe('top');
  });

  it('点对手那一场：木牌的判定范围比马大 —— 点马身和点场次牌都算', () => {
    expect(rivalAt(level, 592, 622, 0)?.id).toBe('r1');
    expect(rivalAt(level, 592, 812, 0)?.id).toBe('r2');
    expect(rivalAt(level, 592, 1002, 0)?.id).toBe('r3');
    // 场上自己的马停在左边，不会挡住对手那一场的判定
    expect(rivalAt(level, 180, 1060, 0)).toBeUndefined();
    // 两场正中（离两块木牌各 95，都在判定半径里）：拿更早的那一场
    expect(rivalAt(level, 592, 717, 0)?.id).toBe('r1');
    // 半径之外（离 r3 有 180）就是点空 —— 点空是零惩罚的
    expect(rivalAt(level, 592, 1160, 0)).toBeUndefined();
    expect(rivalAt(level, 592, 1160, 80)?.id).toBe('r3');
    expect(rivalAt(level, 300, 717, 0)).toBeUndefined();
    // 给一点宽容度就能选中：手指粗的孩子不用对准
    expect(rivalAt(level, 592, 720, 10)?.id).toBe('r2');
    expect(rivalAt(level, 90, 622, 0)).toBeUndefined();
  });

  it('两匹马离得近时，拿最近的那一匹', () => {
    expect(horseNear(level, 374, 1060, 0)?.id).toBe('mid');
    expect(horseNear(level, 200, 1060, 0)?.id).toBe('top');
  });
});

describe('无头验证：演出压短但不许短到看不见', () => {
  it('真实操作原样，无头验证压成几分之一', () => {
    expect(scaledMs(MATCHUP_TIMING.raceMs, false)).toBe(MATCHUP_TIMING.raceMs);
    expect(scaledMs(MATCHUP_TIMING.raceMs, true)).toBe(500);
    expect(scaledMs(10, true)).toBe(MATCHUP_TIMING.autoplayMinMs);
  });

  it('一局真的走得完：三步上马 → 开赛 → 两胜', () => {
    let roster = resetRoster(level);
    for (const { slot, horse } of placements(level, bestRoster(level))) {
      roster = assign(level, roster, slot, horse.id);
    }
    expect(isRosterFull(level, roster)).toBe(true);
    expect(winsFor(level, roster)).toBe(bestWins(level));
    expect(isMatchupDone(level, bestWins(level))).toBe(true);
  });
});

describe('schema：这一关一定赢得了（内容写错不该等孩子打到一半才发现）', () => {
  it('六种配对都赢不到 needWins 场就报错', () => {
    const hopeless = {
      ...level,
      horses: level.horses.map((horse) => ({ ...horse, power: 1 })),
    };
    expect(() => MatchupLevelSchema.parse(hopeless)).toThrow();
    expect(bestMatchupWins(hopeless.horses, level.rivals)).toBe(0);
  });

  it('三个 rank 各一：缺一个就报错', () => {
    expect(() =>
      MatchupLevelSchema.parse({
        ...level,
        horses: level.horses.map((horse) => ({ ...horse, rank: 'top' })),
      }),
    ).toThrow();
  });

  it('对手的 id 不能重复', () => {
    expect(() =>
      MatchupLevelSchema.parse({
        ...level,
        rivals: [level.rivals[0]!, level.rivals[1]!, { ...level.rivals[2]!, id: 'r1' }],
      }),
    ).toThrow();
  });

  it('无头验证：按最好的排法一匹一匹上马，开赛就是两胜', () => {
    let roster = resetRoster(level);
    for (const { slot, horse } of placements(level, bestRoster(level))) {
      roster = assign(level, roster, slot, horse.id);
    }
    expect(isRosterFull(level, roster)).toBe(true);
    expect(resolve(level, roster).map((race) => race.win)).toEqual([false, true, true]);
    expect(isMatchupDone(level, winsFor(level, roster))).toBe(true);
  });

  it('关卡脚本里那三匹马长什么样（与内容 JSON 共用的口径）', () => {
    expect(level.horses.map((horse) => horse.power)).toEqual([6, 5, 4]);
    expect(level.horses.map((horse) => horse.rank)).toEqual(['top', 'mid', 'low']);
    expect(level.rivals.map((rival) => rival.power)).toEqual([7, 5, 3]);
    expect(level.needWins).toBe(2);
    expect(level.hint.length).toBeLessThanOrEqual(24);
    for (const rival of level.rivals) expect(rival.label.length).toBeLessThanOrEqual(12);
  });
});
/* ---------------- order（远交近攻）：一圈势力，按顺序点过去 ---------------- */

/**
 * 第 23 计 · 远交近攻：秦（地图中央 375 / 780）周围一圈六个势力 ——
 * 近的三个（韩 / 魏 / 赵）要处理，远的三个（齐 / 燕 / 楚）先结好。
 */
const order = MatchupOrderLevelSchema.parse({
  mode: 'order',
  neighbors: [
    { id: 'han', x: 375, y: 1010, radius: 66, label: '韩', stance: 'attack' },
    { id: 'wei', x: 140, y: 720, radius: 66, label: '魏', stance: 'attack' },
    { id: 'zhao', x: 620, y: 640, radius: 66, label: '赵', stance: 'attack' },
    { id: 'chu', x: 375, y: 1265, radius: 66, label: '楚', stance: 'ally' },
    { id: 'yan', x: 105, y: 400, radius: 66, label: '燕', stance: 'ally' },
    { id: 'qi', x: 650, y: 430, radius: 66, label: '齐', stance: 'ally' },
  ],
  sequence: ['han', 'wei', 'zhao', 'chu', 'yan', 'qi'],
  hint: '近的先解决，远的先结好',
});

/** 地图中央（秦都）与某个势力的距离 —— 近的一圈 / 远的一圈按它分 */
const CENTER = { x: 375, y: 780 };
function distanceOf(id: string): number {
  const neighbor = order.neighbors.find((item) => item.id === id)!;
  return Math.hypot(neighbor.x - CENTER.x, neighbor.y - CENTER.y);
}

/** 按正确顺序一路点完 */
function walkOrder(state = orderStart(order)) {
  let next = state;
  for (const id of order.sequence) next = pick(next, id);
  return next;
}

describe('order：一圈势力，按正确顺序点过去', () => {
  it('下一个该点谁：从 sequence 的第一个开始，一个一个往后', () => {
    let state = orderStart(order);
    expect(nextIdInOrder(state)).toBe('han');
    expect(expectedNext(order, state)?.label).toBe('韩');
    for (const id of order.sequence) {
      expect(expectedNext(order, state)?.id).toBe(id);
      state = pick(state, id);
    }
    expect(nextIdInOrder(state)).toBeUndefined();
    expect(expectedNext(order, state)).toBeUndefined();
  });

  it('点对了才记进去：pickedOrder 就是点中的先后', () => {
    let state = orderStart(order);
    expect(pickedCount(state)).toBe(0);
    state = pick(state, 'han');
    expect(pickedOrder(state)).toEqual(['han']);
    expect(pickedCount(state)).toBe(1);
    state = pick(state, 'wei');
    expect(pickedOrder(state)).toEqual(['han', 'wei']);
    expect(state.sequence).toEqual(order.sequence); // 顺序是关卡给的，点它不会改
  });

  it('点错了原样返回 —— 零惩罚，顺序可以重排', () => {
    const state = orderStart(order);
    // 该点韩，点了魏：什么也不发生（连对象都是同一个）
    expect(pick(state, 'wei')).toBe(state);
    expect(pick(state, 'qi')).toBe(state);
    expect(pickedCount(state)).toBe(0);
    // 换个不存在的 id 也一样
    expect(pick(state, 'ghost')).toBe(state);
    // 点错之后照样能按正确顺序接着走
    const after = pick(state, 'han');
    expect(pickedOrder(after)).toEqual(['han']);
    expect(expectedNext(order, after)?.id).toBe('wei');
  });

  it('点错只记一笔（复盘用）：不扣星、不结束、已经点对的那些留着', () => {
    let state = pick(pick(orderStart(order), 'han'), 'wei');
    expect(wrongPicks(state)).toBe(0);
    state = noteWrongPick(state); // 该点赵，点了韩 —— 场景这么记
    expect(wrongPicks(state)).toBe(1);
    expect(pickedOrder(state)).toEqual(['han', 'wei']);
    expect(expectedNext(order, state)?.id).toBe('zhao');
    state = pick(state, 'zhao');
    expect(pickedOrder(state)).toEqual(['han', 'wei', 'zhao']);
    expect(wrongPicks(state)).toBe(1);
    // 后面接着点完，错的那一次只是记着，不影响成败
    for (const id of ['chu', 'yan', 'qi']) state = pick(state, id);
    expect(isOrderDone(order, state)).toBe(true);
    expect(wrongPicks(state)).toBe(1);
  });

  it('一圈走完才算成：少一个都不算', () => {
    let state = orderStart(order);
    for (const id of ['han', 'wei', 'zhao', 'chu', 'yan']) {
      state = pick(state, id);
      expect(isOrderDone(order, state)).toBe(false);
    }
    expect(orderProgress(order, state)).toBeCloseTo(5 / 6, 6);
    state = pick(state, 'qi');
    expect(isOrderDone(order, state)).toBe(true);
    expect(orderProgress(order, state)).toBe(1);
    // 点完了再点谁都不动（零惩罚）
    expect(pick(state, 'han')).toBe(state);
  });
});

describe('order：顺序就是"近的先解决，远的先结好"', () => {
  it('内圈三个是 attack，外圈三个是 ally：近的都比远的近', () => {
    const attacks = order.neighbors.filter((item) => item.stance === 'attack').map((item) => item.id);
    const allies = order.neighbors.filter((item) => item.stance === 'ally').map((item) => item.id);
    expect(attacks.sort()).toEqual(['han', 'wei', 'zhao']);
    expect(allies.sort()).toEqual(['chu', 'qi', 'yan']);
    for (const near of attacks) {
      for (const far of allies) expect(distanceOf(near)).toBeLessThan(distanceOf(far));
    }
  });

  it('近的从近到远：韩 230 → 魏 242 → 赵 282', () => {
    const near = ['han', 'wei', 'zhao'].map(distanceOf);
    expect(near[0]).toBeCloseTo(230, 6);
    expect(near[0]).toBeLessThan(near[1]!);
    expect(near[1]).toBeLessThan(near[2]!);
    // sequence 里就是按这个顺序排的
    expect(order.sequence.slice(0, 3)).toEqual(['han', 'wei', 'zhao']);
  });

  it('远的从远到近：楚 485 → 燕 466 → 齐 445', () => {
    const far = ['chu', 'yan', 'qi'].map(distanceOf);
    expect(far[0]).toBeGreaterThan(far[1]!);
    expect(far[1]).toBeGreaterThan(far[2]!);
    expect(order.sequence.slice(3)).toEqual(['chu', 'yan', 'qi']);
  });

  it('neighborsInOrder 就是按 sequence 排好的那一圈（画面与小手都按它走）', () => {
    expect(neighborsInOrder(order).map((item) => item.id)).toEqual(order.sequence);
    expect(neighborsInOrder(order).map((item) => item.label)).toEqual(['韩', '魏', '赵', '楚', '燕', '齐']);
  });

  it('一局真的走得完：按 sequence 一个一个点，点完就成', () => {
    const state = walkOrder();
    expect(isOrderDone(order, state)).toBe(true);
    expect(pickedOrder(state)).toEqual(order.sequence);
    expect(wrongPicks(state)).toBe(0);
  });
});

describe('order：手指粗也点得到（点空是零惩罚的）', () => {
  it('按半径算命中；点空返回 undefined', () => {
    expect(neighborAt(order, 375, 1010, 0)?.id).toBe('han');
    expect(neighborAt(order, 140, 720, 0)?.id).toBe('wei');
    expect(neighborAt(order, 650, 430, 0)?.id).toBe('qi');
    expect(neighborAt(order, 375, 800, 0)).toBeUndefined();
    // 给一点宽容度就能点到：小朋友不用对准
    expect(neighborAt(order, 375, 1010 + 100, MATCHUP_ORDER_TIMING.tapForgive)?.id).toBe('han');
    expect(neighborAt(order, 375, 1010 + 100, 0)).toBeUndefined();
  });

  it('离得近时拿最近的那一个', () => {
    const between = neighborAt(order, 300, 730, 200);
    expect(between?.id).toBe('wei');
  });

  it('势力之间离得够开：点到这个不会串到那个', () => {
    for (let i = 0; i < order.neighbors.length; i += 1) {
      for (let k = i + 1; k < order.neighbors.length; k += 1) {
        const a = order.neighbors[i]!;
        const b = order.neighbors[k]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.radius + b.radius);
        expect(gap, a.id + ' 与 ' + b.id + ' 挨在一起了').toBeGreaterThan(40);
      }
    }
  });
});

describe('order 的 schema 与边界', () => {
  it('正确顺序必须把每个势力刚好排一次', () => {
    expect(() => MatchupOrderLevelSchema.parse({ ...order, sequence: ['han', 'wei', 'zhao', 'chu', 'yan'] })).toThrow();
    expect(() =>
      MatchupOrderLevelSchema.parse({ ...order, sequence: ['han', 'wei', 'zhao', 'chu', 'yan', 'han'] }),
    ).toThrow();
    expect(() =>
      MatchupOrderLevelSchema.parse({ ...order, sequence: ['han', 'wei', 'zhao', 'chu', 'yan', 'ghost'] }),
    ).toThrow();
  });

  it('既要有近的也要有远的 —— 否则这一计没有取舍', () => {
    const allAlly = order.neighbors.map((item) => ({ ...item, stance: 'ally' as const }));
    expect(() => MatchupOrderLevelSchema.parse({ ...order, neighbors: allAlly })).toThrow();
    const allAttack = order.neighbors.map((item) => ({ ...item, stance: 'attack' as const }));
    expect(() => MatchupOrderLevelSchema.parse({ ...order, neighbors: allAttack })).toThrow();
  });

  it('势力的 id 不能重复', () => {
    const dup: MatchupNeighbor[] = [...order.neighbors.slice(0, 5), { ...order.neighbors[5]!, id: 'han' }];
    expect(() => MatchupOrderLevelSchema.parse({ ...order, neighbors: dup })).toThrow();
  });

  it('pair 那一套一个字没变：两种模式的节拍出自同一份', () => {
    expect(MATCHUP_ORDER_TIMING.autoplayStepMs).toBe(MATCHUP_TIMING.autoplayStepMs);
    expect(MATCHUP_ORDER_TIMING.idleMs).toBe(MATCHUP_TIMING.idleMs);
    expect(MATCHUP_ORDER_TIMING.finaleHoldMs).toBe(MATCHUP_TIMING.finaleHoldMs);
    // 马那一半照样算得出孙膑的两胜
    expect(winsFor(level, sunBin)).toBe(2);
    expect(isMatchupDone(level, winsFor(level, sunBin))).toBe(true);
  });
});
