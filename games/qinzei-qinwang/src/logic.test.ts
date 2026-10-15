import { ContentEntrySchema, getEntry, mergeLocalized, validatePatch } from '@chags/content';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import raw from '../../../packages/content/src/entries/qinzei-qinwang.json';
import enPatch from '../../../packages/content/src/i18n/en/qinzei-qinwang.json';
import {
  figureAt, isFigureTried, isSpotDone, isKingFigure, nextFigureToShoot, probeStart,
  remainingFigures, shoot,
} from '../../../packages/templates/src/probe.logic';
import {
  ARCHER, ASIDE_Y, FIGURES, FIGURE_RADIUS, FIGURE_Y, KING_INDEX, WALL,
} from './layout';
import { qinzeiLevel } from './logic';

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('qinzei-qinwang') ?? ContentEntrySchema.parse(raw);
const level = qinzeiLevel(entry);

describe('擒贼擒王 · 关卡数据', () => {
  it('六个身影排成一排 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('spot');
    expect(level.figures.map((figure) => figure.id)).toEqual(FIGURES.map((figure) => figure.id));
    for (const [index, figure] of level.figures.entries()) {
      expect(figure.x).toBe(FIGURES[index]!.x);
      expect(figure.y).toBe(FIGURE_Y);
      expect(figure.radius).toBe(FIGURE_RADIUS);
    }
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('六个身影全在画面里，也都站在城外的旷野上（不在我们的城头上）', () => {
    for (const figure of level.figures) {
      expect(figure.x - figure.radius).toBeGreaterThanOrEqual(0);
      expect(figure.x + figure.radius).toBeLessThanOrEqual(750);
      expect(figure.y + figure.radius).toBeLessThan(WALL.top);
    }
    // 退到一边的人也得站在城墙上面那一片地上
    expect(ASIDE_Y + FIGURE_RADIUS).toBeLessThanOrEqual(WALL.top);
    // 张巡在城头上（墙线以下），往上看那一排人
    expect(ARCHER.y).toBeGreaterThan(WALL.top);
    expect(ARCHER.y).toBeGreaterThan(FIGURE_Y);
  });

  it('恰好一个是王，而且就是美术里说好的那一位（KING_INDEX）', () => {
    const kings = level.figures.filter((figure) => figure.isKing);
    expect(kings).toHaveLength(1);
    expect(kings[0]!.id).toBe(FIGURES[KING_INDEX]!.id);
    expect(isKingFigure(level, FIGURES[KING_INDEX]!.id)).toBe(true);
    expect(isKingFigure(level, 'w1')).toBe(false);
  });

  it('射错只是少一个候选：他退到一边，还能接着试', () => {
    let state = probeStart();
    expect(remainingFigures(level, state)).toBe(6);
    state = shoot(level, state, 'w1');
    expect(isFigureTried(state, 'w1')).toBe(true);
    expect(isSpotDone(state)).toBe(false);
    expect(remainingFigures(level, state)).toBe(5);
    // 同一个身影射两箭不重复计数
    const twice = shoot(level, state, 'w1');
    expect(twice).toBe(state);
    expect(twice.tried).toEqual(['w1']);
    // 下一个接着试，一直试到王
    expect(nextFigureToShoot(level, state)?.id).toBe('w2');
    state = shoot(level, state, 'w2');
    state = shoot(level, state, 'w3');
    state = shoot(level, state, 'w4');
    expect(isSpotDone(state)).toBe(true);
    expect(state.king).toBe('w4');
  });

  it('点选：点在身影的圆圈里就算，点在两排之间就是点空', () => {
    expect(figureAt(level, 90, FIGURE_Y, 0)?.id).toBe('w1');
    expect(figureAt(level, 90, FIGURE_Y, 44)?.id).toBe('w1');
    expect(figureAt(level, 375, 1100, 0)).toBeUndefined();
  });

  it('一局真的走得完：按一排里的顺序试到王为止（与场景同一条路）', () => {
    const steps: string[] = [];
    let state = probeStart();
    for (let i = 0; i < 20 && !isSpotDone(state); i += 1) {
      const figure = nextFigureToShoot(level, state);
      expect(figure).toBeDefined();
      if (figure === undefined) break;
      steps.push(figure.id);
      state = shoot(level, state, figure.id);
    }
    expect(isSpotDone(state)).toBe(true);
    // 王在第四个：前面三个都只是"退到一边"
    expect(steps).toEqual(['w1', 'w2', 'w3', 'w4']);
    expect(state.tried).toEqual(['w1', 'w2', 'w3']);
  });
});

describe('擒贼擒王 · 故事与复习', () => {
  it('两幕：一模一样的一排人 → 蒿箭试出那一个；关键抉择在第一幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((beat) => beat.text.length <= 90)).toBe(true);
    expect(entry.story[0]!.text).toContain('一模一样');
    expect(entry.story[1]!.text).toContain('蒿箭');
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text))
      .toEqual(['用一枝没有杀伤的箭试，看谁的反应最大']);
  });

  it('三十六计的登记信息：第 18 计、攻战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 18, set: 3 });
    expect(entry.yearApprox).toBe(757);
    expect(entry.figures).toEqual(['张巡', '尹子奇']);
    expect(entry.ageRange).toEqual([9, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('擒贼擒王');
    expect(entry.source.quote).toContain('摧其坚');
    expect(entry.moral).toBe('一群人里，先找出最关键的那一个。');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.game.template).toBe('probe');
    expect(entry.game.stages[0]!.template).toBe('probe');
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.filter((question) => question.kind === 'transfer').length).toBeGreaterThanOrEqual(1);
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    for (const question of entry.quiz) expect(question.answer).toBeLessThan(question.options.length);
    expect(entry.quiz[1]!.question).toContain('操场');
  });

  it('儿童化：蒿箭没有杀伤，揭晓语落在"找出关键的那一个"，不是打倒他', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
    ].join('');
    expect(prose).toContain('没有杀伤');
    expect(entry.keyMoment.reveal).toContain('找出关键的那一个');
    expect(entry.keyMoment.reveal).not.toContain('打倒');
    expect(prose).not.toContain('血');
    expect(prose).not.toContain('死');
  });
});

describe('擒贼擒王 · 英译补丁', () => {
  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Catch the Ringleader');
    expect(merged.story.map((beat) => beat.text)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((question) => question.options.length)).toEqual(
      entry.quiz.map((question) => question.options.length),
    );
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
