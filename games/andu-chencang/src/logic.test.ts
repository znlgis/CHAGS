import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { CITY, CLIFF, FOOT_STEPS, GROUND_Y, PATH, PLANK, PLANK_CENTER, pathAt } from './layout';
import { twolineLevel } from './logic';

const entry = getEntry('andu-chencang')!;
const level = twolineLevel(entry);

describe('暗度陈仓 · 关卡数据', () => {
  it('明线栈道在左边的崖上，暗线小路在右边 —— 两处各有一只手能够到的地方', () => {
    expect(level.mode).toBe('stack');
    expect(level.decoy.x).toBe(PLANK_CENTER);
    expect(level.decoy.y).toBe(PLANK.y);
    expect(level.decoy.x).toBeLessThan(CLIFF.right);
    expect(level.real.x).toBeGreaterThan(CLIFF.right);
    expect(level.decoy.radius).toBe(110);
    expect(level.real.radius).toBe(110);
    // 两个命中圈不重叠：点错线这件事不该发生
    const apart = Math.hypot(level.decoy.x - level.real.x, level.decoy.y - level.real.y);
    expect(apart).toBeGreaterThan(level.decoy.radius + level.real.radius);
  });

  it('明线：从满到跌破 minKeep 是 6.7 秒；补一笔 26，撑在 20 以上', () => {
    expect(level.decoy).toMatchObject({ max: 100, decayPerSec: 12, topUp: 26, minKeep: 20 });
    expect(level.decoy.minKeep).toBeLessThan(level.decoy.max);
    expect(level.decoy.topUp).toBeLessThanOrEqual(level.decoy.max);
    expect((level.decoy.max - level.decoy.minKeep) / level.decoy.decayPerSec).toBeCloseTo(6.67, 1);
  });

  it('暗线：一下推 4、推到 100 —— 要点 25 下，小路正好 25 对脚印', () => {
    expect(level.real).toMatchObject({ step: 4, goal: 100 });
    expect(level.real.goal / level.real.step).toBe(25);
    // 脚印数量就是要点几下：画面上"还差几双脚印"是看得见的进度
    expect(FOOT_STEPS).toBe(level.real.goal / level.real.step);
  });

  it('小路真的从暗线的命中圈里穿过去，尽头落在城门上', () => {
    const feet = Array.from({ length: FOOT_STEPS }, (_, i) => pathAt((i + 1) / FOOT_STEPS));
    const inside = feet.filter(
      (p) => Math.hypot(p.x - level.real.x, p.y - level.real.y) <= level.real.radius,
    );
    // 手指点在小路上就能推到：至少有一截脚印落在命中圈里
    expect(inside.length).toBeGreaterThanOrEqual(3);
    expect(pathAt(0).y).toBeLessThanOrEqual(GROUND_Y);
    expect(pathAt(1).y).toBeLessThan(CITY.y + CITY.h);
    // 小路从命中圈下面（山脚）起步，一路爬到命中圈上面（城门）
    expect(PATH.bottomY).toBeGreaterThan(level.real.y);
    expect(PATH.topY).toBeLessThan(level.real.y);
  });

  it('故事两幕：明面上慢慢修 → 夜里进了陈仓；关键抉择在第一幕', () => {
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual([
      '一边修给大家看，一边从别处走',
    ]);
  });

  it('儿童化：全程是工地与夜路，没有交战', () => {
    const text = JSON.stringify(entry);
    expect(entry.story[1]!.narration).toContain('进了陈仓');
    expect(text).not.toContain('血');
    expect(text).not.toContain('杀');
  });

  it('三十六计的登记信息：第 8 计、敌战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 8, set: 2 });
    expect(entry.yearApprox).toBe(-206);
    expect(entry.figures).toEqual(['韩信', '刘邦']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.quote).toContain('益动而巽');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
  });
});

describe('暗度陈仓 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('andu-chencang', 'en')!;
    expect(merged.title).toBe('Secretly March to Chencang');
  });
});
