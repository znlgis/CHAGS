import { ContentEntrySchema, getEntry, mergeLocalized, stageScript, validatePatch } from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/jieshi-huanhun.json';
import rawDetail from '../../../packages/content/src/entries/jieshi-huanhun.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/jieshi-huanhun.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/jieshi-huanhun.game.json';
import { FLAGS, GROUND_Y, POLE, RAISED_Y, SCATTERED, rallySpot } from './layout';
import { bannerLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('jieshi-huanhun') ?? ContentEntrySchema.parse(raw);
const level = bannerLevel(entry);

describe('借尸还魂 · 关卡数据', () => {
  it('旗杆在中央：关卡数据里的 pole 必须一字不差地落在美术那根杆上', () => {
    expect(level.mode).toBe('banner');
    expect(level.pole).toEqual({ x: POLE.x, y: POLE.y, radius: POLE.radius });
    expect(POLE.x).toBe(375); // 正中央
    expect(POLE.y).toBeGreaterThan(RAISED_Y); // 怀抱点在杆上
    expect(POLE.radius).toBeGreaterThanOrEqual(120); // 拖过去不用对准
  });

  it('三面旗 rally 2 / 3 / 4 插在地上，坐标与美术一致', () => {
    expect(level.flags.map((f) => f.id)).toEqual(FLAGS.map((f) => f.id));
    expect(level.flags.map((f) => f.rally)).toEqual([2, 4, 3]);
    level.flags.forEach((flag, index) => {
      expect(flag).toEqual(FLAGS[index]);
      expect(flag.y).toBeGreaterThan(GROUND_Y - 40); // 插在地上
      expect(flag.rally).toBeGreaterThanOrEqual(1);
    });
  });

  it('六个散人、要召回六个：牌面 2+4 或 3+4 才凑得够', () => {
    expect(level.scattered.map((p) => p.id)).toEqual(SCATTERED.map((p) => p.id));
    level.scattered.forEach((person, index) => {
      expect(person).toEqual(SCATTERED[index]);
      expect(person.y).toBeLessThan(GROUND_Y + 60);
    });
    expect(level.needed).toBe(6);
    expect(level.scattered).toHaveLength(6);
    const rallies = level.flags.map((f) => f.rally);
    // 2 + 4 与 3 + 4 都够；只竖一面最多的（4）不够
    expect(rallies[0]! + rallies[1]!).toBeGreaterThanOrEqual(level.needed);
    expect(rallies[2]! + rallies[1]!).toBeGreaterThanOrEqual(level.needed);
    expect(Math.max(...rallies)).toBeLessThan(level.needed);
    expect(rallies.reduce((sum, r) => sum + r, 0)).toBeGreaterThanOrEqual(level.needed);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('归队的人站在旗杆下：都在画面里，也不会跟旗杆叠在一起', () => {
    const spots = level.scattered.map((_person, index) => rallySpot(index));
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThan(40);
      expect(spot.x).toBeLessThan(710);
      expect(Math.abs(spot.x - POLE.x)).toBeGreaterThanOrEqual(120);
      expect(spot.y).toBeLessThanOrEqual(GROUND_Y);
    }
    // 一左一右轮着站，不会挤成一堆
    expect(new Set(spots.map((s) => s.x)).size).toBe(spots.length);
  });

  it('故事两幕：队伍散了 → 旧旗一竖；关键抉择在第一幕', () => {
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((b) => b.text.length <= 90)).toBe(true);
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual([
      '把旧旗竖起来',
    ]);
  });

  it('儿童化：计名里的"尸"按方案保留，但画面与文案里没有尸体', () => {
    // 关卡数据里一个"尸"字都不该有 —— 画面上只有旧旗和散掉的人
    expect(JSON.stringify(level).includes('尸')).toBe(false);
    const text = JSON.stringify({
      story: entry.story,
      keyMoment: entry.keyMoment,
      misconceptions: entry.misconceptions,
      quiz: entry.quiz,
      level,
    });
    for (const word of ['尸体', '尸首', '血', '死', '杀', '刀', '剑']) {
      expect(text.includes(word)).toBe(false);
    }
    expect(entry.title).toBe('借尸还魂'); // 计名保留
    expect(entry.moral).toContain('名号');
  });

  it('三十六计的登记信息：第 14 计、攻战计、陈胜吴广借扶苏项燕之名；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 14, set: 3 });
    expect(entry.yearApprox).toBe(-209);
    expect(entry.figures).toEqual(['陈胜', '吴广']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('借尸还魂');
    expect(entry.source.quote).toContain('有用者，不可借');
    expect(entry.story[1]!.narration).toContain('扶苏');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    for (const q of entry.quiz) expect(q.answer).toBeLessThan(q.options.length);
  });

  it('关卡脚本自己能过 borrow 的 schema（banner 这一支）', () => {
    const script = stageScript(entry, 'borrow');
    expect(templateSchemas.borrow!.safeParse(script).success).toBe(true);
  });
});

describe('借尸还魂 · 英译补丁', () => {
  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法', () => {
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('A Borrowed Name');
    expect(merged.story.map((b) => b.text)).toHaveLength(entry.story.length);
    expect(merged.quiz.map((q) => q.options.length)).toEqual(
      entry.quiz.map((q) => q.options.length),
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
