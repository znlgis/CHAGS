import { ContentEntrySchema, getEntry } from '@chags/content';
import { describe, expect, it } from 'vitest';
import raw from '../../../packages/content/src/entries/shunshou-qianyang.json';
import { windowLevel } from './logic';

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('shunshou-qianyang') ?? ContentEntrySchema.parse(raw);
const level = windowLevel(entry);

/** 一件机会要点几下（判定本身在模板的 window.logic 里有单测） */
function taps(jobId: string): number {
  const job = level.jobs.find((item) => item.id === jobId)!;
  return Math.ceil(job.workMs / level.workTapMs);
}

describe('顺手牵羊 · 关卡数据', () => {
  it('window · glimpse：一趟 45 秒，稳 3 秒、窗口 2.6 秒，一轮路过一件机会', () => {
    expect(level.mode).toBe('glimpse');
    expect(level.travelMs).toBe(45000);
    expect(level.cycle).toEqual({ calmMs: 3000, windowMs: 2600 });
    expect(level.workTapMs).toBe(340);
    expect(level.goal).toBe(3);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('三件机会：走散的羊 / 一捆柴 / 一个水囊，各 1500 毫秒上下的活儿', () => {
    expect(level.jobs.map((j) => [j.id, j.x, j.y, j.radius, j.workMs])).toEqual([
      ['sheep', 105, 960, 92, 1500],
      ['wood', 510, 804, 92, 1500],
      ['skin', 510, 1116, 92, 1400],
    ]);
  });

  it('一件机会在一个窗口里点得完：5 下左右，窗口里还留得下富余', () => {
    for (const job of level.jobs) {
      expect(taps(job.id)).toBeLessThanOrEqual(6);
      // 每一件都必须在一个窗口里干得完 —— 严丝合缝的关卡会让孩子点得手忙脚乱
      expect(job.workMs).toBeLessThanOrEqual(level.cycle.windowMs);
    }
    expect(taps('sheep')).toBe(5);
    expect(taps('wood')).toBe(5);
    expect(taps('skin')).toBe(5);
  });

  it('三件机会摆开在路上，彼此离得够远 —— 点得到，也不会点串', () => {
    for (let i = 0; i < level.jobs.length; i += 1) {
      for (let k = i + 1; k < level.jobs.length; k += 1) {
        const a = level.jobs[i]!;
        const b = level.jobs[k]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.radius + b.radius);
        expect(gap, a.id + ' 与 ' + b.id + ' 挨在一起了').toBeGreaterThan(40);
      }
    }
    // 都在画面里：点不着的机会等于没有
    for (const job of level.jobs) {
      expect(job.x - job.radius).toBeGreaterThanOrEqual(0);
      expect(job.x + job.radius).toBeLessThanOrEqual(750);
      expect(job.y - job.radius).toBeGreaterThan(150);
      expect(job.y + job.radius).toBeLessThanOrEqual(1334);
    }
  });

  it('故事两幕：一幕雪夜赶路看见走散的羊，一幕顺手带上、队伍没停', () => {
    expect(entry.story.length).toBe(2);
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    for (const beat of entry.story) expect(beat.text.length).toBeLessThanOrEqual(90);
    expect(entry.keyMoment.beatId).toBe('s1');
  });

  it('史源用《三十六计》本计按语：第 12 计 · 敌战计（第 2 套）', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 12, set: 2 });
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('顺手牵羊');
    expect(entry.source.quote).toContain('微隙在所必乘');
    expect(entry.yearApprox).toBe(817);
    expect(entry.figures).toEqual(['李愬']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
  });

  it('关键抉择点恰好一个"顺手带上，队伍不停"', () => {
    const options = entry.keyMoment.options;
    expect(options.filter((o) => o.isCanonical).length).toBe(1);
    expect(options.find((o) => o.isCanonical)?.text).toContain('队伍不停');
  });

  it('复习题：记忆题问有没有停下来，迁移题问上学路上走失的小狗', () => {
    const quiz = entry.quiz;
    expect(quiz.length).toBeGreaterThanOrEqual(2);
    expect(quiz.some((q) => q.kind === 'transfer')).toBe(true);
    expect(quiz[0]!.question).toContain('停下来');
    expect(quiz.find((q) => q.kind === 'transfer')?.question).toContain('小狗');
    for (const q of quiz) expect(q.answer).toBeLessThan(q.options.length);
  });

  it('moral 落在"别为了小机会误了正事"上', () => {
    expect(entry.moral).toContain('误了正事');
    expect(entry.keywords.length).toBeGreaterThanOrEqual(2);
    expect(entry.keywords.length).toBeLessThanOrEqual(6);
  });
});
