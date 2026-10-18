import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  MURK_MAX, closeWindow, isJobDone, isMuddy, isWindowDone, jobWork, muddyLeftMs, murkAt,
  stirAt, stirStart, tapAt,
} from '@chags/templates/window.logic';
import {
  BANK_TOP, CREEL, FISH_RADIUS, FISH_SPOTS, MURK_GAUGE, STIR_SPOT, WATER_TOP,
} from './layout';
import { windowLevel } from './logic';

const entry = getEntry('hunshui-moyu')!;
const level = windowLevel(entry);

/** 搅一下水、把一条鱼摸到手里 —— 与场景走的是同一条路（stirAt → tapAt） */
function catchFish(fishId: string, t: number, state = stirStart(level)) {
  let next = stirAt(level, state, t);
  for (let i = 0; i < 12 && !isJobDone(next, fishId); i += 1) {
    next = isMuddy(level, next, t) ? tapAt(next, level, fishId, t) : stirAt(level, next, t);
  }
  return next;
}

/** 一条鱼要点几下 */
function taps(fishId: string): number {
  const job = level.jobs.find((item) => item.id === fishId)!;
  return Math.ceil(job.workMs / level.workTapMs);
}

describe('混水摸鱼 · 关卡数据', () => {
  it('window · stir：水是清的，窗口要自己搅出来', () => {
    expect(level.mode).toBe('stir');
    expect(level.goal).toBe(3);
    expect(level.workTapMs).toBe(320);
    // stir 里"稳 / 乱"的周期不参与判定（schema 与画面要有个参照），鱼最长 1600ms
    expect(level.cycle.windowMs).toBeGreaterThanOrEqual(1600);
    expect(level.workTapMs).toBeLessThan(level.cycle.windowMs);
  });

  it('搅一下 900 毫秒的浑、每秒澄清 45、浑到 60 才算浑水 —— 方案里就是这么写的', () => {
    expect(level.stir).toEqual({
      x: STIR_SPOT.x,
      y: STIR_SPOT.y,
      radius: STIR_SPOT.radius,
      perTapMs: 900,
      clearPerSec: 45,
      muddyAt: 60,
    });
  });

  it('三条鱼：1400 / 1600 / 1200 毫秒的活儿，各 4–5 下摸到', () => {
    expect(level.jobs.map((job) => [job.id, job.workMs])).toEqual([
      ['carp', 1400],
      ['crucian', 1600],
      ['grass', 1200],
    ]);
    expect(taps('carp')).toBe(5);
    expect(taps('crucian')).toBe(5);
    expect(taps('grass')).toBe(4);
    for (const job of level.jobs) {
      // 一条鱼在一个浑水期里摸完最好，摸不完也只是重来（零惩罚）
      expect(job.workMs).toBeLessThanOrEqual(level.cycle.windowMs);
    }
  });

  it('美术画在哪儿，关卡数据就得在哪儿：三条鱼与搅水圈一字不差', () => {
    expect(level.jobs.map((job) => [job.id, job.x, job.y])).toEqual(
      FISH_SPOTS.map((spot) => [spot.id, spot.x, spot.y]),
    );
    for (const job of level.jobs) expect(job.radius).toBe(FISH_RADIUS);
    for (const job of level.jobs) {
      expect(job.y).toBeGreaterThan(WATER_TOP); // 鱼在水里，不在岸上
      expect(job.y + job.radius).toBeLessThan(1334);
      expect(job.x - job.radius).toBeGreaterThanOrEqual(0);
      expect(job.x + job.radius).toBeLessThanOrEqual(750);
    }
    // 搅水圈在岸边那一带，鱼都在它下面 —— 点水面不会点到鱼身上
    expect(STIR_SPOT.y).toBeLessThan(Math.min(...level.jobs.map((job) => job.y)));
    for (const job of level.jobs) {
      const gap = Math.hypot(job.x - STIR_SPOT.x, job.y - STIR_SPOT.y);
      expect(gap).toBeGreaterThan(STIR_SPOT.radius + job.radius);
    }
    // 竹篓、浑度尺都在岸上 / 水塘右边，不压着鱼
    expect(CREEL.y).toBeLessThan(BANK_TOP + 200);
    expect(MURK_GAUGE.x).toBeGreaterThan(Math.max(...level.jobs.map((job) => job.x + job.radius)));
  });

  it('三条鱼彼此离得够开 —— 点得到，也不会点串', () => {
    for (let i = 0; i < level.jobs.length; i += 1) {
      for (let k = i + 1; k < level.jobs.length; k += 1) {
        const a = level.jobs[i]!;
        const b = level.jobs[k]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.radius + b.radius);
        expect(gap, a.id + ' 与 ' + b.id + ' 挨在一起了').toBeGreaterThan(40);
      }
    }
  });
});

describe('混水摸鱼 · 判定：不搅，一条也摸不到', () => {
  it('开局水是清的：点鱼什么也不发生', () => {
    const state = stirStart(level);
    expect(murkAt(state, 0)).toBe(0);
    expect(isMuddy(level, state, 0)).toBe(false);
    expect(tapAt(state, level, 'carp', 1000)).toBe(state);
    expect(jobWork(state, level, 'carp')).toBe(0);
  });

  it('搅一下就浑：一下 +90，够到门槛线以上；一秒之后澄清 45', () => {
    const state = stirAt(level, stirStart(level), 1000);
    expect(murkAt(state, 1000)).toBe(90);
    expect(isMuddy(level, state, 1000)).toBe(true);
    expect(muddyLeftMs(level, state, 1000)).toBeCloseTo(((90 - 60) / 45) * 1000, 6);
    expect(murkAt(state, 2000)).toBe(45);
    expect(isMuddy(level, state, 2000)).toBe(false);
  });

  it('浑水里每点一下推 320 毫秒的活儿 —— 一条鱼要点 4–5 下', () => {
    const state = stirAt(level, stirStart(level), 1000);
    expect(jobWork(tapAt(state, level, 'carp', 1000), level, 'carp')).toBe(320);
    const caught = catchFish('carp', 1000);
    expect(jobWork(caught, level, 'carp')).toBe(1400);
    expect(caught.done).toEqual(['carp']);
  });

  it('连着搅到 100 封顶：不会再高，浑水期也就那么长', () => {
    let state = stirStart(level);
    for (let i = 0; i < 3; i += 1) state = stirAt(level, state, 1000 + i * 50);
    expect(murkAt(state, 1100)).toBe(MURK_MAX);
    expect(muddyLeftMs(level, state, 1100)).toBeCloseTo(((100 - 60) / 45) * 1000, 6);
    // 封顶之后再搅也还是 100：不会越搅越浑
    expect(murkAt(stirAt(level, state, 1100), 1100)).toBe(MURK_MAX);
  });

  it('一局真的走得完：搅浑 → 摸鱼，三条都进竹篓（与场景同一条路）', () => {
    let state = stirStart(level);
    for (const id of ['carp', 'crucian', 'grass']) state = catchFish(id, 6000, state);
    expect(isWindowDone(level, state)).toBe(true);
    expect(state.done).toEqual(['carp', 'crucian', 'grass']);
    expect(jobWork(state, level, 'grass')).toBe(1200);
  });
});

describe('混水摸鱼 · 零惩罚：水清了只是重来', () => {
  it('摸了一半水就清了：进度清零、摸到的留着，不扣星也不结束', () => {
    let state = stirAt(level, stirStart(level), 1000);
    for (let i = 0; i < 3; i += 1) state = tapAt(state, level, 'carp', 1000);
    expect(jobWork(state, level, 'carp')).toBe(960);

    const cleared = closeWindow(state, level);
    expect(jobWork(cleared, level, 'carp')).toBe(0);
    expect(cleared.done).toEqual([]);
    expect(cleared.resets).toBe(1); // 只记一笔"白跑一趟"，不扣星、不结束
    expect(isWindowDone(level, cleared)).toBe(false);

    // 再搅一下就能接着摸
    const again = stirAt(level, cleared, 4000);
    expect(isMuddy(level, again, 4000)).toBe(true);
    expect(jobWork(tapAt(again, level, 'carp', 4000), level, 'carp')).toBe(320);
  });

  it('摸到的鱼不会被水清掉：水再清也还在篓里', () => {
    const caught = catchFish('grass', 1000);
    const cleared = closeWindow(caught, level);
    expect(cleared.done).toEqual(['grass']);
    expect(jobWork(cleared, level, 'grass')).toBe(1200);
    expect(cleared.resets).toBe(0); // 没有半截的活儿，不算白跑一趟
  });
});

describe('混水摸鱼 · 故事与复习', () => {
  it('两幕：一河之隔，人少的一方；阵脚一乱，趁乱过河', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story[0]!.text).toContain('人多');
    expect(entry.story[1]!.text).toContain('乱');
    expect(entry.keyMoment.beatId).toBe('s1');
  });

  it('三十六计：第 20 计 · 混战计（第 4 套），史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 20, set: 4 });
    expect(entry.source.book).toBe('《三十六计·混战计》');
    expect(entry.source.chapter).toBe('混水摸鱼');
    expect(entry.source.quote).toContain('乘其阴乱');
    expect(entry.yearApprox).toBe(383);
    expect(entry.figures).toEqual(['朱序', '谢玄']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.game.template).toBe('window');
    expect(entry.game.stages[0]!.template).toBe('window');
  });

  it('关键抉择点恰好一个"先把水搅浑"', () => {
    const options = entry.keyMoment.options;
    expect(options.find((option) => option.isCanonical)?.text).toContain('搅');
    expect(entry.keyMoment.reveal).toContain('搅');
  });

  it('复习题：记忆题问朱序做了什么，迁移题问教室乱的时候怎么办', () => {
    const transfer = entry.quiz.find((question) => question.kind === 'transfer');
    expect(transfer?.question).toContain('教室');
  });

  it('儿童化：鱼只是滑走，水里没有一处流血', () => {
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

describe('混水摸鱼 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('hunshui-moyu', 'en')!;
    expect(merged.title).toBe('Muddy the Water to Catch Fish');
  });
});
