import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { windowLevel } from './logic';

/** 周期摊开：稳 calmMs → 乱 windowMs，一轮一轮地摆（判定本身在模板的 window.logic 里有单测） */

function windowsOf(level: ReturnType<typeof windowLevel>, count: number): { open: number; close: number }[] {
  const span = level.cycle.calmMs + level.cycle.windowMs;
  return Array.from({ length: count }, (_, i) => ({
    open: i * span + level.cycle.calmMs,
    close: (i + 1) * span,
  }));
}

describe('趁火打劫 · 关卡数据', () => {
  const raw = getEntry('chenhuo-dajie');
  const level = windowLevel(raw!);

  it('夜里的水寨：稳 4.2 秒、乱 3 秒，一轮一轮地摆', () => {
    expect(level.mode).toBe('fire');
    expect(level.cycle).toEqual({ calmMs: 4200, windowMs: 3000 });
    expect(windowsOf(level, 3)).toEqual([
      { open: 4200, close: 7200 },
      { open: 11400, close: 14400 },
      { open: 18600, close: 21600 },
    ]);
  });

  it('三件活儿：渡船 / 粮囤 / 水门，坐标与方案一致', () => {
    expect(level.jobs.map((j) => [j.id, j.x, j.y, j.radius, j.workMs])).toEqual([
      ['boat', 240, 1020, 90, 2600],
      ['grain', 430, 940, 90, 2200],
      ['gate', 620, 1020, 90, 2000],
    ]);
    expect(level.goal).toBe(3);
  });

  it('点一下 340 毫秒的活儿：一件活儿要连点 6–8 下，窗口里干得完', () => {
    expect(level.workTapMs).toBe(340);
    for (const job of level.jobs) {
      const taps = Math.ceil(job.workMs / level.workTapMs);
      expect(taps).toBeGreaterThanOrEqual(6);
      expect(taps).toBeLessThanOrEqual(8);
      // 方案要求：一件活儿必须在一个窗口里干得完
      expect(job.workMs).toBeLessThanOrEqual(level.cycle.windowMs);
    }
  });

  it('三件活儿排成一条弧线，都在画面下半部分（栈桥与水面）', () => {
    const xs = level.jobs.map((j) => j.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    for (const job of level.jobs) expect(job.y).toBeGreaterThan(900);
  });

  it('关键抉择在第一幕，史源用《三十六计》本计按语', () => {
    expect(raw?.keyMoment.beatId).toBe('s1');
    expect(raw?.source.book).toContain('三十六计');
    expect(raw?.source.quote).toContain('就势取利');
  });

  it('三十六计：第 5 计 · 胜战计（第 1 套）', () => {
    expect(raw?.group).toBe('stratagem');
    expect(raw?.kind).toBe('strategy');
    expect(raw?.stratagem).toEqual({ number: 5, set: 1 });
    expect(raw?.yearApprox).toBe(-482);
    expect(raw?.ageRange).toEqual([7, 11]);
  });

  it('关键抉择点恰好一个"等精兵走远"', () => {
    const options = raw!.keyMoment.options;
    expect(options.find((o) => o.isCanonical)?.text).toContain('走远');
  });

  it('复习题：记忆题问等到了什么，迁移题问搭积木什么时候最合适', () => {
    const quiz = raw!.quiz;
    expect(quiz[0]!.question).toContain('等到');
    expect(quiz.find((q) => q.kind === 'transfer')?.question).toContain('积木');
  });
});
