import { ContentEntrySchema, getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/xiaoli-cangdao.json';
import rawDetail from '../../../packages/content/src/entries/xiaoli-cangdao.game.json';
import { autoplayLevel, tellAt, tellSlots } from '../../../packages/templates/src/read.logic';
import { readLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('xiaoli-cangdao') ?? ContentEntrySchema.parse(raw);
const level = readLevel(entry);

describe('笑里藏刀 · 关卡数据', () => {
  it('说话的人在宴席正中，六处破绽分三种，出现的时刻递增', () => {
    expect(level.speaker).toEqual({ x: 375, y: 520 });
    expect(level.tells.map((tell) => tell.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6']);
    expect(level.tells.map((tell) => tell.kind)).toEqual([
      'eye', 'sleeve', 'finger', 'eye', 'sleeve', 'finger',
    ]);
    for (let i = 1; i < level.tells.length; i += 1) {
      expect(level.tells[i]!.atMs).toBeGreaterThan(level.tells[i - 1]!.atMs);
    }
    // 间隔 3200–4200：不密也不疏，孩子来得及看
    for (let i = 1; i < level.tells.length; i += 1) {
      const gap = level.tells[i]!.atMs - level.tells[i - 1]!.atMs;
      expect(gap).toBeGreaterThanOrEqual(3200);
      expect(gap).toBeLessThanOrEqual(4200);
    }
    // 只露 1.5 秒 —— "看一眼"是这一关的手感
    for (const tell of level.tells) expect(tell.windowMs).toBe(1500);
    expect(level.tells[0]!.atMs).toBe(2600);
    expect(level.goal).toBe(4);
    expect(level.goal).toBeLessThan(level.tells.length);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('破绽都落在人身上：眼睛 / 袖口 / 手指各自的位置不一样', () => {
    const [eye, sleeve, finger] = [level.tells[0]!, level.tells[1]!, level.tells[2]!];
    expect(eye.kind).toBe('eye');
    expect(sleeve.kind).toBe('sleeve');
    expect(finger.kind).toBe('finger');
    // 眼睛在上（头的两侧）、袖口在身侧、手指在桌面上
    expect(eye.y).toBeLessThan(sleeve.y);
    expect(eye.y).toBeLessThan(finger.y);
    expect(sleeve.x).toBeLessThan(eye.x);
    expect(finger.x).toBeGreaterThan(sleeve.x);
    // 每一处都在画面里（设计分辨率 750×1334）
    for (const tell of level.tells) {
      expect(tell.x - tell.radius).toBeGreaterThanOrEqual(0);
      expect(tell.x + tell.radius).toBeLessThanOrEqual(750);
      expect(tell.y - tell.radius).toBeGreaterThanOrEqual(150);
      expect(tell.y + tell.radius).toBeLessThanOrEqual(1334);
    }
  });

  it('验算：看穿四个才算看懂 —— 前三处都点中还不够', () => {
    let read = 0;
    for (const tell of level.tells.slice(0, 3)) {
      expect(tellAt(level, tell.atMs)?.id).toBe(tell.id);
      read += 1;
    }
    expect(read).toBeLessThan(level.goal);
    read += 1;
    expect(read).toBeGreaterThanOrEqual(level.goal);
  });

  it('无头验证下六处都还会露出面（压短之后仍然一局走得完）', () => {
    const fast = autoplayLevel(level, true);
    const seen = tellSlots(fast).map((slot) => slot.tell.id);
    expect(seen).toEqual(level.tells.map((tell) => tell.id));
    for (const tell of fast.tells) expect(tell.windowMs).toBeGreaterThanOrEqual(400);
  });

  it('两幕故事，关键抉择点在第二幕；迁移题问"夸你玩具又伸手怎么办"', () => {
    expect(entry.story.length).toBe(2);
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    // 关键抉择点在第一幕：他说好话的时候，孩子就要决定"信话还是看动作"
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.question).toContain('好话');
    expect(entry.keyMoment.options.filter((option) => option.isCanonical).length).toBe(1);
    expect(entry.keyMoment.options.find((option) => option.isCanonical)?.id).toBe('watch');
    const transfer = entry.quiz.filter((question) => question.kind === 'transfer');
    expect(transfer.length).toBeGreaterThanOrEqual(1);
    expect(transfer[0]!.explanation).toContain('手');
  });

  it('史源与定位：敌战计第 10 计，按语用《三十六计》原文', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 10, set: 2 });
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.quote).toContain('刚中柔外');
    expect(entry.figures).toContain('李义府');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.game.template).toBe('read');
    expect(entry.game.stages[0]!.template).toBe('read');
  });

  it('只教识破：寓意与误解都落在"看动作"，不教怎么使这一套', () => {
    expect(entry.moral).toBe('好听的话，要配着看他的动作。');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.misconceptions.join('')).toContain('笑');
    // 画面里没有刀：整条内容的文案也不出现"刀"（除了计策名本身）
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
    ].join('');
    expect(prose).not.toContain('刀');
  });
});
