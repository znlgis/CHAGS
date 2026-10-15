import {
  ContentEntrySchema, EntryDetailSchema, EntrySummarySchema, getEntry, mergeLocalized, splitEntry,
  validatePatch,
} from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/kongcheng-ji.json';
import rawDetail from '../../../packages/content/src/entries/kongcheng-ji.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/kongcheng-ji.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/kongcheng-ji.game.json';
import {
  calmPhaseAt, calmStart, calmTick, cleanWatches, effectiveCalmLevel, hitGate, isCalmDone,
  openGate, replayCalm, tapCalm,
} from '../../../packages/templates/src/stillness.logic';
import {
  AWAY, DESIGN_H, DESIGN_W, DRUM, FLAGS, GATE, HINT, MAX_MARKS, NEEDED, ROAD_TOP, SKY_TOP,
  WALL_BOTTOM, WALL_TOP, WATCH, WATCHES, ZHAOYUN,
} from './layout';
import { kongchengLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('kongcheng-ji') ?? ContentEntrySchema.parse(raw);
const level = kongchengLevel(entry);

/**
 * 模板的"点城门"宽容度（stillness.ts 里 CALM.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 56;

/** 三轮的"他移开目光"各从哪儿开始（= 每一轮盯着看的结束）与一共多久 */
const WATCH_ENDS = [3400, 8200, 12400];
const TOTAL_MS = 14000;
/** 每一轮"他正盯着"的时候 / 他移开目光的时候各取一个点 */
const WATCH_AT = [1500, 6000, 11000];
const GAP_AT = [4000, 9000, 13200];

describe('空城计 · 关卡数据', () => {
  it('三轮的时长、要忍住的轮数、城门的位置，与画好的一模一样', () => {
    expect(level.mode).toBe('calm');
    expect(level.watches.map((watch) => watch.id)).toEqual(WATCHES.map((watch) => watch.id));
    for (const [index, watch] of level.watches.entries()) {
      expect(watch.watchMs).toBe(WATCHES[index]!.watchMs);
      expect(watch.gapMs).toBe(WATCHES[index]!.gapMs);
    }
    expect(level.gate).toEqual({ x: GATE.x, y: GATE.y, radius: GATE.radius });
    expect(level.needed).toBe(NEEDED);
    expect(level.hint).toBe(HINT);
    expect(level.hint.length).toBeLessThanOrEqual(24);
    expect(level.doubtLine.length).toBeLessThanOrEqual(48);
    expect(level.leaveLine.length).toBeLessThanOrEqual(48);
  });

  it('三轮盯着看一共 14 秒；忍住两轮他就退（第三轮是留给"白忍一轮"的余地）', () => {
    expect(level.watches.reduce((sum, w) => sum + w.watchMs + w.gapMs, 0)).toBe(TOTAL_MS);
    expect(level.needed).toBeLessThan(level.watches.length);
    const state = calmTick(level, openGate(level, calmStart()), TOTAL_MS);
    expect(cleanWatches(state)).toBe(NEEDED);
    expect(isCalmDone(level, state)).toBe(true);
  });

  it('营门开在营墙上、离人够远；赵云站在墙头，曹军站在门前的路上', () => {
    expect(GATE.x).toBeGreaterThan(0);
    expect(GATE.x).toBeLessThan(DESIGN_W);
    expect(GATE.y - GATE.radius).toBeGreaterThan(WALL_TOP);
    expect(GATE.y + GATE.radius).toBeLessThan(WALL_BOTTOM);
    // 手指粗也点得到
    expect(GATE.radius).toBeGreaterThanOrEqual(120);

    // 赵云站在墙头上（脚在墙头），不挡着营门
    expect(ZHAOYUN.y).toBe(WALL_TOP);
    expect(ZHAOYUN.x).toBeLessThan(GATE.x - GATE.radius);
    // 蒙着布的鼓、放倒的旗也都在墙头上
    expect(DRUM.y).toBeGreaterThan(WALL_TOP - 60);
    expect(DRUM.y).toBeLessThan(WALL_TOP);
    for (const flag of FLAGS) {
      expect(flag.y).toBeGreaterThan(WALL_TOP - 60);
      expect(flag.y).toBeLessThan(WALL_TOP);
      expect(flag.x).toBeGreaterThan(GATE.x + GATE.radius);
    }

    // 曹军盯着看的时候就在营门正前方（抬头往上看），移开目光是往路那一头去
    expect(WATCH.y).toBeGreaterThan(WALL_BOTTOM);
    expect(WATCH.y).toBeGreaterThan(ROAD_TOP);
    expect(Math.abs(WATCH.x - GATE.x)).toBeLessThan(40);
    expect(AWAY.x).toBeGreaterThan(WATCH.x);
    expect(AWAY.x + 80).toBeLessThan(DESIGN_W);
    expect(AWAY.y).toBeGreaterThan(ROAD_TOP);

    expect(SKY_TOP).toBeLessThan(WALL_TOP);
    expect(WALL_TOP).toBeLessThan(WALL_BOTTOM);
    expect(WALL_BOTTOM).toBeLessThan(DESIGN_H);
    expect(MAX_MARKS).toBeGreaterThanOrEqual(1);
  });

  it('手指落在营门上才算开门；点在人身上、路上都不算（零惩罚）', () => {
    expect(hitGate(GATE.x, GATE.y, level, TAP_FORGIVE)).toBe(true);
    expect(hitGate(GATE.x, GATE.y, level)).toBe(true);
    expect(hitGate(GATE.x, GATE.y + GATE.radius + TAP_FORGIVE + 4, level, TAP_FORGIVE)).toBe(false);
    expect(hitGate(ZHAOYUN.x, ZHAOYUN.y, level, TAP_FORGIVE)).toBe(false);
    expect(hitGate(WATCH.x, WATCH.y, level, TAP_FORGIVE)).toBe(false);
    expect(hitGate(AWAY.x, AWAY.y, level, TAP_FORGIVE)).toBe(false);
  });
});

describe('空城计 · 一局真的走得完', () => {
  it('先点 gate 开城门：门没开之前点哪儿都不算"动了"', () => {
    expect(calmPhaseAt(level, calmStart(), 500).phase).toBe('gate');
    expect(tapCalm(level, calmStart(), 500)).toEqual(calmStart());

    const opened = openGate(level, calmStart());
    expect(opened.gateOpen).toBe(true);
    expect(calmPhaseAt(level, opened, 500).phase).toBe('watch');
  });

  it('盯着的时候点一下就白忍一轮：这一轮不算数，下一轮照样能赢（零惩罚）', () => {
    let state = openGate(level, calmStart());
    // 第一轮他正盯着：动了一下
    expect(calmPhaseAt(level, state, WATCH_AT[0]!).phase).toBe('watch');
    state = tapCalm(level, state, WATCH_AT[0]!);
    expect(state.slips).toBe(1);
    state = calmTick(level, state, WATCH_ENDS[0]!);
    expect(cleanWatches(state)).toBe(0);

    // 第二轮忍住：攒下第一轮
    expect(calmPhaseAt(level, state, WATCH_AT[1]!).phase).toBe('watch');
    state = calmTick(level, state, WATCH_ENDS[1]!);
    expect(cleanWatches(state)).toBe(1);
    expect(isCalmDone(level, state)).toBe(false);

    // 第三轮忍住：忍够两轮，他退了
    state = calmTick(level, state, WATCH_ENDS[2]!);
    expect(cleanWatches(state)).toBe(NEEDED);
    expect(isCalmDone(level, state)).toBe(true);
  });

  it('一下都不动：第二轮的盯着看完他就退了（不用等到三轮）', () => {
    let state = openGate(level, calmStart());
    state = calmTick(level, state, WATCH_ENDS[0]!);
    expect(isCalmDone(level, state)).toBe(false);
    state = calmTick(level, state, WATCH_ENDS[1]!);
    expect(cleanWatches(state)).toBe(NEEDED);
    expect(isCalmDone(level, state)).toBe(true);
    expect(state.slips).toBe(0);
  });

  it('他移开目光的时候点一下什么也不算 —— 他没看见', () => {
    let state = openGate(level, calmStart());
    for (const t of GAP_AT) state = tapCalm(level, state, t);
    expect(state.slips).toBe(0);
    // 三轮空档里点过三下，一轮都没白忍；忍够 needed 就停（他退了，后面的不用再数）
    state = calmTick(level, state, TOTAL_MS);
    expect(cleanWatches(state)).toBe(NEEDED);
    expect(isCalmDone(level, state)).toBe(true);
  });

  it('三轮全看完还没忍够：从头再盯一遍，忍住的轮数留着（零惩罚，也不会卡死）', () => {
    let state = openGate(level, calmStart());
    state = tapCalm(level, state, WATCH_AT[0]!);
    state = tapCalm(level, state, WATCH_AT[1]!);
    state = calmTick(level, state, TOTAL_MS);
    expect(calmPhaseAt(level, state, TOTAL_MS).phase).toBe('done');
    expect(cleanWatches(state)).toBe(1);
    expect(isCalmDone(level, state)).toBe(false);

    state = replayCalm(state);
    state = calmTick(level, state, WATCH_ENDS[0]!);
    expect(isCalmDone(level, state)).toBe(true);
    expect(state.slips).toBe(2);
  });

  it('无头验证压过之后照样走得完，而且压出来的关卡仍然合法', () => {
    const fast = effectiveCalmLevel(level, true, 5);
    expect(templateSchemas.stillness!.safeParse(fast).success).toBe(true);
    let state = openGate(fast, calmStart());
    state = calmTick(fast, state, 1200);
    state = calmTick(fast, state, 1200 + 360 + 1200);
    expect(isCalmDone(fast, state)).toBe(true);
  });
});

describe('空城计 · 故事与复习', () => {
  it('两幕：赵云营里人少 → 大开营门，曹军疑心退了；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((beat) => beat.text.length <= 90)).toBe(true);
    expect(entry.story[0]!.text).toContain('赵云');
    expect(entry.story[1]!.text).toContain('营门');
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['先别动 —— 大开营门，让他自己起疑']);
    expect(entry.keyMoment.reveal).toContain('紧张');
  });

  it('三十六计的登记信息：第 32 计、败战计、兵法；史源出自《云别传》', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 32, set: 6 });
    expect(entry.yearApprox).toBe(219);
    expect(entry.figures).toEqual(['赵云', '曹操']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·败战计》');
    expect(entry.source.chapter).toBe('空城计');
    expect(entry.source.quote).toContain('虚者虚之');
    expect(entry.moral).toBe('越是紧张，越不能乱动。');
    expect(entry.story.some((beat) => beat.narration.includes('云别传'))).toBe(true);
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.game.template).toBe('stillness');
    expect(entry.game.stages[0]!.template).toBe('stillness');
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.filter((question) => question.kind === 'transfer').length).toBeGreaterThanOrEqual(1);
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    for (const question of entry.quiz) {
      expect(question.answer).toBeLessThan(question.options.length);
    }
    expect(entry.quiz[1]!.question).toContain('紧张');
  });

  it('儿童化：不出现流血死亡，"不动"也不是认输', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.question,
      entry.keyMoment.reveal,
    ].join('');
    expect(prose).not.toContain('血');
    expect(prose).not.toContain('死');
    expect(entry.moral).toContain('不能乱动');
  });
});

describe('空城计 · 英译补丁', () => {
  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('The Empty Fort');
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Desperate Stratagems');
    expect(merged.story.map((beat) => beat.text)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((question) => question.options.length)).toEqual(
      entry.quiz.map((question) => question.options.length),
    );
    for (const stage of merged.game.stages) {
      expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    }
    // 英译的 hint 同样 ≤24 字符（关卡里的短句换语言也得短）
    const hint = (merged.game.stages[0]!.levelScript as { hint: string }).hint;
    expect(hint.length).toBeLessThanOrEqual(24);
    expect(hint).toBe('Freeze while he looks');
    expect(findCjk(merged)).toEqual([]);
  });

  it('与 content:check 同一套判据：两半各自过 schema、合并之后也过', () => {
    // 拆分规则与内容体检同源：两半合起来正好是完整条目
    expect(EntrySummarySchema.safeParse(rawSummary).success).toBe(true);
    expect(EntryDetailSchema.safeParse(rawDetail).success).toBe(true);
    expect(splitEntry(entry)).toEqual({ summary: rawSummary, detail: rawDetail });

    const mergedSummary = EntrySummarySchema.parse(mergeLocalized(rawSummary, enPatchSummary));
    const mergedDetail = EntryDetailSchema.parse(mergeLocalized(rawDetail, enPatchDetail));
    expect(mergedSummary.moral).toBe('The more tense it gets, the less you may move.');
    // 英文的屏幕文字同样卡 90 字符（story.text 的上限按英文给）
    expect(mergedDetail.story.every((beat) => beat.text.length <= 90)).toBe(true);
    expect(mergedDetail.quiz.some((question) => question.kind === 'transfer')).toBe(true);
    expect(ContentEntrySchema.safeParse({ ...mergedSummary, ...mergedDetail }).success).toBe(true);
    // 英文版的关卡脚本再过一遍模板 schema（content:check 也会重查一次）
    for (const stage of mergedDetail.game.stages) {
      expect(templateSchemas[stage.template]!.safeParse(stage.levelScript).success).toBe(true);
    }
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
