import { ContentEntrySchema, getEntry, mergeLocalized, validatePatch } from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import rawSummary from '../../../packages/content/src/entries/wuzhong-shengyou.json';
import rawDetail from '../../../packages/content/src/entries/wuzhong-shengyou.game.json';
import enPatchSummary from '../../../packages/content/src/i18n/en/wuzhong-shengyou.json';
import enPatchDetail from '../../../packages/content/src/i18n/en/wuzhong-shengyou.game.json';
import { ARROW_FROM, GUNWALE_Y, SHADOW_DOTS, SLOT_RADIUS, SLOT_XS, SUSPICION, WATER_TOP } from './layout';
import { showLevel } from './logic';

/** 内容拆成了摘要（首屏）与详情（进游戏才加载）两半，测试里合起来用 */
const raw = { ...rawSummary, ...rawDetail };
const enPatch = { ...enPatchSummary, ...enPatchDetail };

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('wuzhong-shengyou') ?? ContentEntrySchema.parse(raw);
const level = showLevel(entry);

describe('无中生有 · 关卡数据', () => {
  it('六个空位排在船帮上 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.slots.map((s) => s.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(level.slots.map((s) => s.x)).toEqual([...SLOT_XS]);
    for (const slot of level.slots) {
      expect(slot.y).toBe(GUNWALE_Y);
      expect(slot.radius).toBe(SLOT_RADIUS);
      expect(slot.y).toBeGreaterThan(WATER_TOP); // 船帮在江面之上
    }
  });

  it('一笔立 4.2 秒、同时要立住 4 个影子 —— 手一停，势就落', () => {
    expect(level.mode).toBe('draw');
    expect(level.fadeMs).toBe(4200);
    expect(level.needed).toBe(4);
    expect(level.goal).toBe(100);
    // 空位比需要的多：有喘气的余地，但也没法站着不动
    expect(level.slots.length).toBeGreaterThan(level.needed);
    // 撑着 4 个影子，大约每 1.05 秒就得补一笔
    const tapsPerSec = level.needed / (level.fadeMs / 1000);
    expect(tapsPerSec).toBeGreaterThan(0.9);
    expect(tapsPerSec).toBeLessThan(1.1);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('疑心条在船帮上方，四个小灯排在它右边；箭从画面外的对岸飞进来', () => {
    expect(SUSPICION.y + SUSPICION.h).toBeLessThan(GUNWALE_Y);
    expect(SHADOW_DOTS.x).toBeGreaterThan(SUSPICION.x + SUSPICION.w);
    const lastDot = SHADOW_DOTS.x + (level.needed - 1) * SHADOW_DOTS.gap;
    expect(lastDot).toBeLessThan(750);
    expect(ARROW_FROM.x).toBeLessThan(SLOT_XS[0]); // 对岸在画面外，箭横着飞过来
    expect(ARROW_FROM.y).toBeLessThan(GUNWALE_Y);
  });

  it('故事两幕：雾里的空船 → 草人立起来；关键抉择在第二幕', () => {
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((b) => b.text.length <= 90)).toBe(true);
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(entry.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual([
      '在空位上把草人一个个立起来',
    ]);
  });

  it('儿童化：雾里的箭全扎在草人身上，没有一个人受伤', () => {
    const text = JSON.stringify(entry);
    expect(entry.story[1]!.narration).toContain('没有一个人受伤');
    expect(text).not.toContain('血');
    expect(text).not.toContain('尸体');
  });

  it('三十六计的登记信息：第 7 计、敌战计、兵法；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 7, set: 2 });
    expect(entry.yearApprox).toBe(208);
    expect(entry.figures).toEqual(['诸葛亮', '鲁肃']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.quote).toContain('实其所诳也');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    for (const q of entry.quiz) expect(q.answer).toBeLessThan(q.options.length);
  });
});

describe('无中生有 · 英译补丁', () => {
  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法', () => {
    // 与 content:check 同一套判据：结构镜像 → 合并 → 合并后仍要过内容 schema 与模板 schema
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Something Out of Nothing');
    expect(merged.story.map((b) => b.text)).toHaveLength(entry.story.length);
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

