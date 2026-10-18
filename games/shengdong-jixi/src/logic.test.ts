import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { CAMP_Y, TOWER } from './layout';
import { ruseLevel } from './logic';

describe('声东击西 · 关卡数据', () => {
  const raw = getEntry('shengdong-jixi');
  const level = ruseLevel(raw!);

  it('三件东西都从右下出发 —— 灯照左边的时候，右边才走得通', () => {
    expect(level.mode).toBe('divert');
    expect(level.items.map((i) => i.id)).toEqual(['cart', 'torch', 'waterskin']);
    const gaze = level.gaze;
    expect(gaze).toBeDefined();
    const mid = (gaze!.left.x + gaze!.right.x) / 2;
    for (const item of level.items) {
      expect(item.x).toBeGreaterThan(mid);
      expect(item.y).toBeGreaterThan(CAMP_Y);
      // 这一关不换外壳：靠的是时机
      expect(item.shells).toEqual([]);
    }
  });

  it('锣鼓都在左边：敲得响，灯就被留在那边', () => {
    expect(level.noises.map((n) => n.id)).toEqual(['gong-left', 'drum-left']);
    for (const noise of level.noises) {
      expect(noise.x).toBeLessThan(TOWER.x);
      expect(noise.holdMs).toBe(2600);
    }
  });

  it('关口在右上、望楼在正中：灯照右时那一片正好压住去关口的路', () => {
    expect(level.gate.x).toBeGreaterThan(TOWER.x);
    expect(level.gate.y).toBeLessThan(CAMP_Y);
    const gaze = level.gaze!;
    expect(Math.abs(TOWER.x - (gaze.left.x + gaze.right.x) / 2)).toBeLessThan(60);
    for (const item of level.items) {
      const toGate = Math.hypot(item.x - level.gate.x, item.y - level.gate.y);
      expect(toGate).toBeGreaterThan(level.gate.radius);
    }
  });

  it('灯 3.4 秒亮一次 —— 比第 1 计快，所以要先造一个"东边"出来', () => {
    expect(level.lamp).toEqual({ intervalMs: 3400, warnMs: 900 });
  });

  it('故事两幕：到处说要往东走 → 连夜从西边过去', () => {
    expect(raw?.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(raw?.keyMoment.beatId).toBe('s1');
    expect(raw?.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual([
      '把热闹都摆到东边',
    ]);
    expect(raw?.source.book).toContain('三十六计');
    expect(raw?.source.quote).toContain('敌志乱萃');
  });

  it('三十六计的登记信息：第 6 计、胜战计、兵法', () => {
    expect(raw?.group).toBe('stratagem');
    expect(raw?.kind).toBe('strategy');
    expect(raw?.stratagem).toEqual({ number: 6, set: 1 });
    expect(raw?.yearApprox).toBe(87);
    expect(raw?.figures).toEqual(['班超']);
    expect(raw?.ageRange).toEqual([8, 12]);
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(raw?.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
  });
});
