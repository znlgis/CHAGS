import { getEntry } from '@chags/content/full';
import {
  countsFor, happyLeft, isGreedy, isSplitSolved, mood, moodLine, splitState, stepToward,
  watchedCount,
} from '@chags/templates/split.logic';
import { describe, expect, it } from 'vitest';
import {
  CAMP, FAR_CAMP, LEFT_X, RIGHT_X, RIVER_LEFT, RIVER_RIGHT, ROPE_Y, TOWER, WATCHER,
} from './layout';
import { believableLefts, splitLevel, watchedBin } from './logic';

const entry = getEntry('kurou-ji')!;
const level = splitLevel(entry);

describe('苦肉计 · 关卡数据：八袋粮，两边分', () => {
  it('开局全在自己这边：一袋都还没送出去，探子当然不信', () => {
    expect(level.total).toBe(8);
    expect(level.initialLeft).toBe(8);
    expect(level.minPerSide).toBe(1);
    expect(level.bins.map((bin) => bin.kind)).toEqual(['kept', 'given']);
    expect(countsFor(splitState(level.initialLeft, level), level)).toEqual({ kept: 8, given: 0 });
    expect(watchedCount(splitState(level.initialLeft, level), level)).toBe(0);
    expect(mood(splitState(level.initialLeft, level), level)).toBe('angry');
  });

  it('探子只看"送出去的"那一头：够五袋才点头', () => {
    expect(level.audience.watchedBinId).toBe('given');
    expect(level.audience.happyAt).toBe(5);
    expect(watchedBin(level)?.id).toBe('given');
    expect(watchedCount(splitState(3, level), level)).toBe(5);
    expect(mood(splitState(3, level), level)).toBe('happy');
    expect(mood(splitState(4, level), level)).toBe('angry');
    expect(moodLine(splitState(3, level), level)).toBe(level.audience.happyLine);
    expect(moodLine(splitState(4, level), level)).toBe(level.audience.angryLine);
  });

  it('一头也不能空：全送光了不算分好 —— 零惩罚，挪回来就是', () => {
    const allGiven = splitState(0, level);
    expect(watchedCount(allGiven, level)).toBe(8);
    expect(mood(allGiven, level)).toBe('happy');
    expect(isGreedy(allGiven, level)).toBe(true);
    expect(isSplitSolved(allGiven, level)).toBe(false);
    // 留 1–3 袋在自己手里：他信了，自己人也还有得吃
    expect(believableLefts(level)).toEqual([1, 2, 3]);
    for (const left of believableLefts(level)) {
      expect(isSplitSolved(splitState(left, level), level)).toBe(true);
    }
  });

  it('八袋一颗不多一颗不少：不管木牌挪到哪儿，等式都成立', () => {
    for (let left = 0; left <= level.total; left += 1) {
      const counts = countsFor(splitState(left, level), level);
      expect(counts.kept! + counts.given!).toBe(8);
    }
  });

  it('一局真的走得完：一格一格挪到三（与场景里小手、autoplay 同一条路）', () => {
    let state = splitState(level.initialLeft, level);
    const target = happyLeft(level);
    expect(target).toBe(3);
    let steps = 0;
    for (let guard = 0; guard < 20 && !isSplitSolved(state, level); guard += 1) {
      const next = stepToward(state, target, level);
      expect(Math.abs(next.left - state.left)).toBe(1);
      state = next;
      steps += 1;
    }
    expect(steps).toBe(5);
    expect(state.left).toBe(3);
    expect(countsFor(state, level)).toEqual({ kept: 3, given: 5 });
    expect(isSplitSolved(state, level)).toBe(true);
  });
});

describe('苦肉计 · 美术与关卡数据互锁', () => {
  it('两个盘子画在两岸上、同挂在一条船绳上 —— 否则绳子画在这儿、袋子分在那儿', () => {
    expect(level.bins[0]!.x).toBe(LEFT_X);
    expect(level.bins[1]!.x).toBe(RIGHT_X);
    expect(level.bins[0]!.y).toBe(ROPE_Y);
    expect(level.bins[1]!.y).toBe(ROPE_Y);
    // 我们这边在左岸，送出去的那一头在右岸（中间隔着江）
    expect(LEFT_X).toBeLessThan(RIVER_LEFT);
    expect(RIGHT_X).toBeGreaterThan(RIVER_RIGHT);
    expect(watchedBin(level)!.x).toBe(RIGHT_X);
    // 两座营也都在岸上，不在江里
    expect(CAMP.x).toBeLessThan(RIVER_LEFT);
    expect(FAR_CAMP.x).toBeGreaterThan(RIVER_RIGHT);
    // 探子站在对岸的望楼上，看的就是"送出去的"那一头
    expect(TOWER.x).toBeGreaterThan(RIVER_RIGHT);
    expect(WATCHER.x).toBe(TOWER.x);
    expect(WATCHER.y).toBeLessThan(TOWER.y);
  });

  it('两个盘子彼此分得开，标签一眼读得完', () => {
    for (const bin of level.bins) {
      expect(bin.label.length).toBeLessThanOrEqual(8);
      expect(bin.label.length).toBeGreaterThan(0);
    }
    expect(level.bins[1]!.x - level.bins[0]!.x).toBeGreaterThan(0);
  });
});

describe('苦肉计 · 故事与复习', () => {
  it('两幕：先问"对面凭什么信"，再送出去一份 —— 关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s2');
  });

  it('关键抉择问"怎么让他信" —— 正解是当众送出去一份看得见的', () => {
    const options = entry.keyMoment.options;
    expect(options.filter((option) => option.isCanonical)).toHaveLength(1);
    const canonical = options.find((option) => option.isCanonical)!;
    expect(canonical.text).toContain('送');
    for (const option of options) {
      if (option.isCanonical) continue;
      // 另外两个选项不是"点了就错"，都要说清楚后果 —— 这条不在 zod schema 里，得留着
      expect(option.hint.length).toBeGreaterThan(0);
    }
    expect(entry.keyMoment.reveal).toContain('看得见');
  });

  it('三十六计的登记信息：第 34 计 · 败战计（第 6 套）；史源用本计按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 34, set: 6 });
    expect(entry.dynasty).toBe('东汉');
    expect(entry.yearApprox).toBe(208);
    expect(entry.figures).toContain('黄盖');
    expect(entry.figures).toContain('曹操');
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·败战计》');
    expect(entry.source.chapter).toBe('苦肉计');
    expect(entry.source.quote).toBe('人不自害，受害必真。假真真假，间以得行。童蒙之吉，顺以巽也。');
    expect(entry.moral).toContain('看得见');
    expect(entry.game.template).toBe('split');
    expect(entry.game.stages[0]!.template).toBe('split');
  });

  it('复习题：记忆题问"凭什么信"与"为什么送"，迁移题落在"做出来比说更管用"', () => {
    const transfer = entry.quiz.find((question) => question.kind === 'transfer')!;
    expect(transfer.question).toContain('值日');
    expect(transfer.explanation).toContain('看得见');
  });

  it('儿童化：没有一处流血受伤 —— 代价是"送出去的一份东西"', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation + question.options.join('')),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '伤', '交战', '挨打']) expect(prose).not.toContain(word);
    // 落点落在"真心要让人看见"上，而不是落在"受罚"上
    expect(prose).toContain('送');
    expect(prose).toContain('看得见');
  });
});

describe('苦肉计 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('kurou-ji', 'en')!;
    expect(merged.title).toBe('Pay a Real Price');
    expect(merged.game.stages[0]!.levelScript).toMatchObject({
      bins: [{ label: 'We keep' }, { label: 'We give' }],
      hint: 'Slide until he believes',
    });
    expect(merged.moral).toBe(
      'Meaning it is not enough: put out something others can see, and then they believe you.',
    );
  });
});
