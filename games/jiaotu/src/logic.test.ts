import { getEntry } from '@chags/content';
import { neededBurrows, openCount, waveResult } from '@chags/templates/burrow.logic';
import { describe, expect, it } from 'vitest';
import { MEADOW_Y } from './layout';
import { burrowLevel } from './logic';

describe('狡兔三窟 · 关卡数据', () => {
  const raw = getEntry('jiaotu');
  const level = burrowLevel(raw!);

  it('三个土坡，每个挖四铲', () => {
    expect(level.spots.map((s) => s.id)).toEqual(['left', 'mid', 'right']);
    expect(level.digsNeeded).toBe(4);
  });

  it('土坡画在草地上 —— 美术和关卡数据必须一致', () => {
    for (const spot of level.spots) expect(spot.y).toBe(MEADOW_Y);
  });

  it('第一次危险守一个洞口，第二次守两个 —— 这就是"三窟"的由来', () => {
    expect(level.waves.map((w) => w.blocks)).toEqual([1, 2]);
    expect(neededBurrows(level)).toBe(3);
  });

  it('一个洞遇上狐狸就出不去；两个洞才躲得过第一次', () => {
    expect(waveResult({ left: 4 }, level.waves[0]!, level)).toBe('trapped');
    // 没挖通的洞不算退路：挖了 3 铲的那个洞口还堵着
    expect(openCount({ left: 4, mid: 3 }, level)).toBe(1);
    expect(waveResult({ left: 4, mid: 4 }, level.waves[0]!, level)).toBe('safe');
  });

  it('故事两幕：先看见兔子，再听冯谖那句话', () => {
    expect(raw?.story.length).toBe(2);
    expect(raw?.keyMoment.beatId).toBe('s2');
    expect(raw?.source.book).toContain('战国策');
  });
});
