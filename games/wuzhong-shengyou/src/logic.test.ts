import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import {
  ARROW_FROM, GUNWALE_Y, SHADOW_DOTS, SLOT_RADIUS, SLOT_XS, SUSPICION, WATER_TOP,
} from './layout';
import { showLevel } from './logic';

const entry = getEntry('wuzhong-shengyou')!;
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
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
  });
});

describe('无中生有 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('wuzhong-shengyou', 'en')!;
    expect(merged.title).toBe('Something Out of Nothing');
  });
});
