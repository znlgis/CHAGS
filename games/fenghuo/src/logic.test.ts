import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { beaconLevel } from './logic';

describe('烽火戏诸侯 · 关卡数据', () => {
  const level = beaconLevel(getEntry('fenghuo')!);

  it('山脊上一串烽火台，从近到远', () => {
    expect(level.towers.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < level.towers.length; i += 1) {
      expect(level.towers[i]!.x).toBeGreaterThan(level.towers[i - 1]!.x);
      expect(level.towers[i]!.y).toBeLessThan(level.towers[i - 1]!.y);
    }
  });

  it('信任的格数就是戏弄的次数 —— 点完刚好用完', () => {
    expect(level.decoyRounds).toBeGreaterThanOrEqual(2);
    expect(level.decoyRounds).toBeLessThanOrEqual(4);
  });

  it('四句台词都在，而且不啰嗦（提示气泡放得下）', () => {
    for (const line of [level.lines.first, level.lines.again, level.lines.empty, level.lines.end]) {
      expect(line.length).toBeGreaterThan(0);
      expect(line.length).toBeLessThanOrEqual(48);
    }
    expect(level.hint.length).toBeGreaterThan(0);
  });

  it('烽火台都开在画面里', () => {
    for (const tower of level.towers) {
      expect(tower.x).toBeGreaterThan(60);
      expect(tower.x).toBeLessThan(730);
      expect(tower.y).toBeGreaterThan(400);
      expect(tower.y).toBeLessThan(950);
    }
  });
});
