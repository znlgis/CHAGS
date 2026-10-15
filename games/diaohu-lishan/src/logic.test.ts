import { ContentEntrySchema, getEntry, mergeLocalized, validatePatch } from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
// 模板的纯判定：共享 index.ts 的登记由 Lead 统一做 —— 这里直接从源文件拿，
// 与既有游戏包相对导入内容 JSON 是同一个做法（登记前后都不会红）。
import {
  bestBait, decoyStart, grabAt, guardBack, isDecoyDone, placeBait,
} from '../../../packages/templates/src/lure.logic';
import rawSummary from '../../../packages/content/src/entries/diaohu-lishan.json';
import rawDetail from '../../../packages/content/src/entries/diaohu-lishan.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/diaohu-lishan.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/diaohu-lishan.game.json';
import {
  BAIT_RADIUS, BAIT_XS, BAIT_YS, CHEST, FAR_HILLS, GROUND_TOP, PASS, RIDGE_BOTTOM, RIDGE_TOP,
} from './layout';
import { lureLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('diaohu-lishan') ?? ContentEntrySchema.parse(raw);
const level = lureLevel(entry);
if (level.mode !== 'decoy') throw new Error('第 15 计 · 调虎离山是 decoy（把看守引开）');
const decoy = level;

describe('调虎离山 · 关卡数据与美术互锁', () => {
  it('守将站在山口那个豁口里 —— 美术画的豁口就是关卡数据里的岗位', () => {
    expect(decoy.guard.x).toBe(PASS.x);
    expect(decoy.guard.y).toBe(PASS.y);
    expect(decoy.guard.radius).toBe(96);
    expect(decoy.guard.y).toBeGreaterThan(RIDGE_TOP); // 在山脊线的下沿
    expect(decoy.guard.y).toBeLessThan(RIDGE_BOTTOM);
  });

  it('三个诱饵点都在"山那边"的山顶上，顺序与关卡数据一致', () => {
    expect(decoy.baits.map((bait) => bait.id)).toEqual(['fire', 'smoke', 'lantern']);
    expect(decoy.baits.map((bait) => bait.x)).toEqual([...BAIT_XS]);
    expect(decoy.baits.map((bait) => bait.y)).toEqual([...BAIT_YS]);
    decoy.baits.forEach((bait, index) => {
      const hill = FAR_HILLS[index]!;
      expect(bait.radius).toBe(BAIT_RADIUS);
      expect(bait.y).toBeLessThan(RIDGE_TOP); // 山脊之上 = 山那边
      expect(bait.x).toBe(hill.x); // 每处都落在自己那座远山的正中
      expect(bait.y).toBeLessThan(hill.y); // 在山顶之上（不埋进山里）
      expect(bait.y + BAIT_RADIUS).toBeGreaterThanOrEqual(hill.y); // 也不悬空
    });
  });

  it('要搬走的箱子在山脚 —— 位置与美术里的箱子一字不差', () => {
    expect(decoy.prize.x).toBe(CHEST.x);
    expect(decoy.prize.y).toBe(CHEST.y);
    expect(decoy.prize.radius).toBe(100);
    expect(decoy.prize.y).toBeGreaterThan(GROUND_TOP);
  });

  it('教学点：只有后两个诱饵点空得够久（第一个差了整整一秒多）', () => {
    expect(decoy.baits.map((bait) => bait.awayMs)).toEqual([3200, 5200, 7000]);
    expect(decoy.prize.needMs).toBe(4800);
    expect(decoy.baits.filter((b) => b.awayMs >= decoy.prize.needMs).map((b) => b.id)).toEqual([
      'smoke', 'lantern',
    ]);
    // 最短的那个不是"差一点"，是差得看得见
    expect(decoy.prize.needMs - decoy.baits[0]!.awayMs).toBeGreaterThan(1000);
  });
});

describe('调虎离山 · 一局真的走得完（照模板 runAutoplay 的同一条路）', () => {
  it('先选够长的诱饵点，再按住箱子：山口的空档刚好够把它搬走', () => {
    const bait = bestBait(decoy)!;
    expect(bait.id).toBe('smoke'); // 够长的里面最短的那个
    let state = placeBait(decoy, decoyStart(), bait.id, 0);
    let t = 0;
    while (!isDecoyDone(decoy, state) && t < 20000) {
      state = guardBack(decoy, state, t);
      state = grabAt(decoy, state, t);
      t += 16;
    }
    expect(isDecoyDone(decoy, state)).toBe(true);
    expect(state.grabMs).toBe(decoy.prize.needMs);
    expect(state.returns).toBe(0); // 一次都没被打断
    expect(t).toBeLessThanOrEqual(bait.awayMs);
  });

  it('选最短的那个诱饵点：白等一场，清零重来（零惩罚）', () => {
    let state = placeBait(decoy, decoyStart(), 'fire', 0);
    for (let t = 0; t < 3200; t += 16) state = grabAt(decoy, state, t);
    expect(isDecoyDone(decoy, state)).toBe(false);
    const back = guardBack(decoy, state, 3200);
    expect(back.baitId).toBeNull();
    expect(back.grabMs).toBe(0);
    expect(back.returns).toBe(1);
    expect(back.usedBaits).toEqual(['fire']);
    // 换一个够久的诱饵点，照样能拿 —— 重来多少次都行
    expect(placeBait(decoy, back, 'lantern', 3200).baitId).toBe('lantern');
    expect(decoy.prize.needMs).toBeLessThanOrEqual(7000);
  });
});

describe('调虎离山 · 内容', () => {
  it('故事两幕：山口一步不离 → 山那边闹起来；关键抉择在第一幕', () => {
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((b) => b.text.length <= 90)).toBe(true);
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual([
      '在山那边放个诱饵，把他引开',
    ]);
    expect(entry.story[1]!.text).toContain('山口空了');
  });

  it('儿童化：山口只有守将与炊烟，没有交战、没有流血', () => {
    const text = JSON.stringify(entry);
    expect(text).not.toContain('血');
    expect(text).not.toContain('打起来');
    expect(entry.moral).toBe('把他引开，路就通了。');
  });

  it('三十六计的登记信息：第 15 计、攻战计（第三套）；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 15, set: 3 });
    expect(entry.yearApprox).toBe(199);
    expect(entry.figures).toEqual(['孙策', '刘勋']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('调虎离山');
    expect(entry.source.quote).toContain('用人以诱之');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.game.template).toBe('lure');
    expect(entry.game.stages[0]!.template).toBe('lure');
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    for (const q of entry.quiz) expect(q.answer).toBeLessThan(q.options.length);
  });
});

describe('调虎离山 · 英译补丁', () => {
  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Lure the Tiger from the Mountain');
    expect(merged.story.map((b) => b.title)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((q) => q.options.length)).toEqual(entry.quiz.map((q) => q.options.length));
    for (const stage of merged.game.stages) {
      expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    }
    expect(findCjk(merged)).toEqual([]);
  });
});

/** 中日韩字符：英文版里出现它，就说明这个字段漏翻了（与 content:check 同一套判据） */
const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

function findCjk(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return CJK.test(value) ? [path] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findCjk(item, path + '[' + index + ']'));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      findCjk(item, path === '' ? key : path + '.' + key),
    );
  }
  return [];
}
