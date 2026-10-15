import { ContentEntrySchema, getEntry, mergeLocalized, stageScript, validatePatch } from '@chags/content';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import raw from '../../../packages/content/src/entries/yuqin-guzong.json';
import enPatch from '../../../packages/content/src/i18n/en/yuqin-guzong.json';
import {
  HOLD, PROGRESS, PURSUER, RULER, RUNNER, SKY_TOP, STAMINA, runnerScale, runnerX,
} from './layout';
import { chaseLevel } from './logic';

/** 登记由 Lead 统一做：登记前直接看内容文件，测试不因登记顺序而红 */
const entry = getEntry('yuqin-guzong') ?? ContentEntrySchema.parse(raw);
const level = chaseLevel(entry);

describe('欲擒故纵 · 关卡数据', () => {
  it('按住那颗按钮在下方：关卡数据里的 hold 必须一字不差地落在美术那颗按钮上', () => {
    expect(level.hold).toEqual({ x: HOLD.x, y: HOLD.y, radius: HOLD.radius });
    expect(HOLD.y + HOLD.radius).toBeLessThan(1334);
    // 按钮整个在距离刻度下面，不会抢手指
    expect(HOLD.y - HOLD.radius).toBeGreaterThan(RULER.y + RULER.h);
    expect(HOLD.radius).toBeGreaterThanOrEqual(100); // 小孩的手指也按得住
  });

  it('区间 34–70、开局 70 就在区间里；四条速率照方案', () => {
    expect(level.mode).toBe('hold');
    expect(level.start).toEqual({ distance: 70, stamina: 100 });
    expect(level.keepMin).toBe(34);
    expect(level.keepMax).toBe(70);
    expect(level.start.distance).toBeGreaterThan(level.keepMin);
    expect(level.start.distance).toBeLessThanOrEqual(level.keepMax);
    expect(level.closePerSec).toBe(16);
    expect(level.farPerSec).toBe(12);
    expect(level.drainPerSec).toBe(7);
    expect(level.recoverPerSec).toBe(4);
    expect(level.losePerSec).toBe(5);
    // 逼太近一定比待在区间里吃亏（schema 也这么要求）
    expect(level.recoverPerSec).toBeLessThan(level.drainPerSec);
    expect(level.hint.length).toBeLessThanOrEqual(24);
  });

  it('距离就是画面上的远近：0 在最近处、100 在最远处，都还在画面里', () => {
    expect(runnerX(0)).toBe(RUNNER.minX);
    expect(runnerX(100)).toBe(RUNNER.maxX);
    expect(RUNNER.minX).toBeGreaterThan(PURSUER.x); // 跑的人一直在追的人前面
    expect(RUNNER.maxX).toBeLessThan(750);
    expect(runnerScale(0)).toBe(1);
    expect(runnerScale(100)).toBeLessThan(0.7); // 跟丢的时候人影明显小了

    // 两条槽在两个人影上方，距离刻度在他们下面
    expect(SKY_TOP).toBe(150);
    expect(STAMINA.y).toBeGreaterThan(SKY_TOP);
    expect(STAMINA.y + STAMINA.h).toBeLessThan(PROGRESS.y);
    expect(PROGRESS.y + PROGRESS.h).toBeLessThan(PURSUER.y);
    expect(RULER.y).toBeGreaterThan(RUNNER.y);
  });

  it('要维持的区间整个落在刻度里 —— 绿色那一段就是 keepMin–keepMax', () => {
    const bandLeft = RULER.x + (RULER.w * level.keepMin) / 100;
    const bandRight = RULER.x + (RULER.w * level.keepMax) / 100;
    expect(bandLeft).toBeGreaterThan(RULER.x);
    expect(bandRight).toBeLessThanOrEqual(RULER.x + RULER.w);
    expect(bandRight - bandLeft).toBeGreaterThan(RULER.w * 0.3);
  });

  it('故事两幕：追得太紧 → 松一松；关键抉择在第一幕', () => {
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.story.every((b) => b.text.length <= 90)).toBe(true);
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual([
      '跟住但别逼太近，等他没力气',
    ]);
  });

  it('儿童化：这一计的"擒"落在"让他心服"，不是把人抓住、更没有流血', () => {
    const text = JSON.stringify({
      moral: entry.moral,
      story: entry.story,
      keyMoment: entry.keyMoment,
      misconceptions: entry.misconceptions,
      quiz: entry.quiz,
      level,
    });
    for (const word of ['血', '尸体', '杀死', '受伤', '兵器']) {
      expect(text.includes(word)).toBe(false);
    }
    expect(entry.keyMoment.reveal).toContain('心服');
    expect(entry.story[1]!.narration).toContain('自己慢了下来');
  });

  it('三十六计的登记信息：第 16 计、攻战计、七擒孟获；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 16, set: 3 });
    expect(entry.yearApprox).toBe(225);
    expect(entry.figures).toEqual(['诸葛亮', '孟获']);
    expect(entry.ageRange).toEqual([9, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('欲擒故纵');
    expect(entry.source.quote).toContain('逼则反兵');
    expect(entry.misconceptions.length).toBeGreaterThanOrEqual(1);
    expect(entry.keywords).toHaveLength(3);
  });

  it('复习题：有记忆题也有迁移题，答案都在选项里', () => {
    expect(entry.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
    expect(entry.quiz.length).toBeGreaterThanOrEqual(2);
    for (const q of entry.quiz) expect(q.answer).toBeLessThan(q.options.length);
  });

  it('关卡脚本自己能过 chase 的 schema', () => {
    const script = stageScript(entry, 'chase');
    expect(templateSchemas.chase.safeParse(script).success).toBe(true);
  });
});

describe('欲擒故纵 · 英译补丁', () => {
  it('与中文一一对应、合起来不剩一个中文字，关卡脚本照样合法', () => {
    // 与 content:check 同一套判据：结构镜像 → 合并 → 合并后仍要过内容 schema 与模板 schema
    expect(validatePatch(entry, enPatch)).toEqual([]);
    const merged = ContentEntrySchema.parse(mergeLocalized(entry, enPatch));
    expect(merged.title).toBe('Let Him Go to Win Him Over');
    expect(merged.story.map((b) => b.text)).toHaveLength(entry.story.length);
    expect(merged.keyMoment.options.map((o) => o.text)).toHaveLength(
      entry.keyMoment.options.length,
    );
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
