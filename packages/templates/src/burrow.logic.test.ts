import { describe, expect, it } from 'vitest';
import { BurrowLevelSchema } from './schemas';
import {
  blockedBy, digCount, escapeRoute, isBurrowOpen, neededBurrows, nextSpotToDig, openBurrows,
  openCount, spotAt, waveResult,
} from './burrow.logic';

/** 三个土坡，每个挖三铲；狐狸守 1 个洞口，猎人加狐狸守 2 个 */
const level = BurrowLevelSchema.parse({
  spots: [
    { id: 'left', x: 150, y: 900, radius: 100, kind: 'grass' },
    { id: 'mid', x: 375, y: 900, radius: 100, kind: 'mound' },
    { id: 'right', x: 600, y: 900, radius: 100, kind: 'rock' },
  ],
  digsNeeded: 3,
  waves: [
    { id: 'fox', blocks: 1, speak: '狐狸来了。' },
    { id: 'hunter', blocks: 2, speak: '猎人和狐狸一起来了。' },
  ],
  hint: '多挖几个洞',
});

const dig = (id: string, times = 3): Record<string, number> => ({ [id]: times });
const digMany = (...ids: string[]): Record<string, number> =>
  Object.fromEntries(ids.map((id) => [id, 3]));

describe('挖洞', () => {
  it('挖够铲数才算通，多挖不算多一个洞', () => {
    expect(isBurrowOpen('left', dig('left', 2), level)).toBe(false);
    expect(isBurrowOpen('left', dig('left', 3), level)).toBe(true);
    expect(digCount('left', { left: 99 }, level)).toBe(3);
    expect(digCount('nope', {}, level)).toBe(0);
  });

  it('只数挖通的洞，而且按关卡顺序', () => {
    expect(openBurrows({ left: 1, mid: 3, right: 3 }, level)).toEqual(['mid', 'right']);
    expect(openCount({ left: 3, mid: 3 }, level)).toBe(2);
  });

  it('同一个洞反复挖不增加退路', () => {
    expect(openCount({ left: 99 }, level)).toBe(1);
  });
});

describe('危险来了', () => {
  it('一个洞遇上守一个洞口的狐狸：出不去（这就是"一窟"的下场）', () => {
    expect(escapeRoute(1, 1)).toBe(false);
    expect(waveResult(dig('left'), level.waves[0]!, level)).toBe('trapped');
  });

  it('两个洞遇上狐狸：还有一条路', () => {
    expect(waveResult(digMany('left', 'mid'), level.waves[0]!, level)).toBe('safe');
  });

  it('猎人和狐狸守住两个洞口：必须三窟', () => {
    expect(waveResult(digMany('left', 'mid'), level.waves[1]!, level)).toBe('trapped');
    expect(waveResult(digMany('left', 'mid', 'right'), level.waves[1]!, level)).toBe('safe');
  });

  it('"三窟"是数据逼出来的：最凶的危险守 2 个，就得多准备一个', () => {
    expect(neededBurrows(level)).toBe(3);
  });

  it('危险先守住已经挖通的那些洞口', () => {
    expect(blockedBy(digMany('left', 'mid'), level.waves[0]!, level)).toEqual(['left']);
    expect(blockedBy(digMany('left', 'mid', 'right'), level.waves[1]!, level)).toEqual([
      'left', 'mid',
    ]);
  });
});

describe('提示与无头验证', () => {
  it('手指落在最近的土坡上，宽容度让小朋友不用对准', () => {
    expect(spotAt(150, 900, level)?.id).toBe('left');
    expect(spotAt(620, 940, level)?.id).toBe('right');
    expect(spotAt(375, 1200, level, 60)).toBeNull();
  });

  it('下一个该挖的是"挖得最深、还没通"的那个 —— 不会挖一半又跑去开新洞', () => {
    expect(nextSpotToDig({ left: 1, mid: 2 }, level)?.id).toBe('mid');
    expect(nextSpotToDig(digMany('left', 'mid', 'right'), level)).toBeUndefined();
  });
});

describe('schema', () => {
  it('挡住"无论怎么挖都躲不过去"的关卡', () => {
    expect(() =>
      BurrowLevelSchema.parse({
        ...level,
        waves: [{ id: 'a', blocks: 3, speak: '来了。' }],
      }),
    ).toThrow();
  });

  it('挡住重复的土坡 id', () => {
    expect(() =>
      BurrowLevelSchema.parse({
        ...level,
        spots: [level.spots[0], { ...level.spots[1], id: 'left' }],
      }),
    ).toThrow();
  });
});
