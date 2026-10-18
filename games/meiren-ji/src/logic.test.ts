import { getEntry } from '@chags/content/full';
import { templateSchemas } from '@chags/templates/schemas';
import { describe, expect, it } from 'vitest';
import {
  FAVOR_TIMING, favorProgress, favorStart, favorsGiven, gazeAt, giftAt, glanceAt,
  glanceCycleMs, glanceMs, hintGift, isFavorDone, offerFavor, wantedGift,
} from '@chags/templates/lure.logic';
import { DESIGN_H, DESIGN_W, GIFT_KINDS, GIFT_RADIUS, KING, TABLE_XS, TABLE_Y } from './layout';
import { meirenLevel } from './logic';

const entry = getEntry('meiren-ji')!;
const level = meirenLevel(entry);

/**
 * 模板的点击宽容度（lure.ts 里 LURE_FAVOR.tapForgive）。
 * 这里刻意不 import '@chags/templates'：那个入口会拉进 Phaser，
 * 而纯逻辑测试要能在 node 里直接跑（与既有的几个游戏测试同一条规矩）。
 */
const TAP_FORGIVE = 56;

describe('美人计 · 美术与关卡数据互锁', () => {
  it('三样东西摆在美术画的那三张案上 —— 美术画在哪儿，关卡数据就得在哪儿', () => {
    expect(level.mode).toBe('favor');
    expect(level.gifts.map((gift) => gift.id)).toEqual(['horse', 'silk', 'sword']);
    for (const [index, gift] of level.gifts.entries()) {
      expect(gift.x).toBe(TABLE_XS[index]!);
      expect(gift.y).toBe(TABLE_Y);
      expect(gift.radius).toBe(GIFT_RADIUS);
      expect(gift.kind).toBe(GIFT_KINDS[index]!);
      // 点在那样东西的圆心上，拿到的就是它（手指粗也能点到）
      expect(giftAt(level, gift.x, gift.y, TAP_FORGIVE)?.id).toBe(gift.id);
    }
    // 他就坐在那张席上；他在意的是丝绸
    expect(level.target).toMatchObject(KING);
    expect(level.target.wants).toBe('silk');
    expect(level.needOffers).toBe(1);
  });

  it('三样东西与他的席都在画面里，点在空处什么也不算', () => {
    for (const gift of level.gifts) {
      expect(gift.x - gift.radius).toBeGreaterThan(0);
      expect(gift.x + gift.radius).toBeLessThan(DESIGN_W);
      expect(gift.y - gift.radius).toBeGreaterThan(KING.y + KING.radius);
    }
    expect(KING.y - KING.radius).toBeGreaterThan(0);
    expect(TABLE_Y + GIFT_RADIUS).toBeLessThan(DESIGN_H);
    expect(giftAt(level, 375, 300, TAP_FORGIVE)).toBeUndefined();
  });
});

describe('美人计 · 教育点：他的目光落在最在意的那一样上（"先弄清别人在意什么"）', () => {
  it('他最在意的是丝绸 —— 一整圈的目光里，落在它上面的时间最长', () => {
    const wanted = wantedGift(level);
    expect(wanted?.id).toBe('silk');
    expect(wanted?.kind).toBe(level.target.wants);
    const totals: Record<string, number> = {};
    for (let t = 0; t < glanceCycleMs(level); t += 50) {
      const gift = glanceAt(level, t);
      if (gift === null) continue;
      totals[gift.id] = (totals[gift.id] ?? 0) + 50;
    }
    // 被看得最久的是它，而且比另外两样久得多（看得出来，不是猜出来）
    expect(totals['silk']).toBeGreaterThan(totals['horse'] ?? 0);
    expect(totals['silk']).toBeGreaterThan(totals['sword'] ?? 0);
    expect(totals['silk']).toBeGreaterThanOrEqual((totals['horse'] ?? 0) * 3);
  });

  it('目光周期性回到它上面：一圈的开头总是那匹丝绸', () => {
    const cycle = glanceCycleMs(level);
    expect(glanceAt(level, 0)?.id).toBe('silk');
    expect(glanceAt(level, cycle)?.id).toBe('silk');
    expect(glanceMs).toBe(FAVOR_TIMING.glanceMs);
    // 看着别处的时候是"谁也没看"
    expect(glanceAt(level, cycle - 10)).toBeNull();
    expect(gazeAt(level, cycle - 10).gift).toBeNull();
  });

  it('一次都还没递过时，小手指的就是他此刻在看的那样', () => {
    const state = favorStart();
    expect(hintGift(level, state, 0)?.id).toBe('silk');
    expect(hintGift(level, state, glanceMs)?.id).toBe('horse');
  });
});

describe('美人计 · 一局真的走得完（与场景同一条路）', () => {
  it('先看清他的目光，再把那一样送上去 —— 送错的两样只是回到手里', () => {
    const state = favorStart();
    // 没看清之前：送错两样，东西回到手里（零惩罚，不扣星、不结束）
    expect(offerFavor(level, state, 'horse')).toBe('refused');
    expect(offerFavor(level, state, 'sword')).toBe('refused');
    expect(favorsGiven(state)).toBe(0);
    expect(isFavorDone(level, state)).toBe(false);
    expect(favorProgress(level, state)).toBe(0);
    // 看出来的那一样：送上去，他就收下了
    expect(offerFavor(level, state, 'silk')).toBe('loved');
    expect(favorsGiven(state)).toBe(1);
    expect(state.lastLoved).toBe(true);
    expect(isFavorDone(level, state)).toBe(true);
    expect(favorProgress(level, state)).toBe(1);
    // 三次递交都记在账上：送错的那两次不算失败
    expect(state.offers).toBe(3);
    expect(state.offered).toEqual(['horse', 'sword', 'silk']);
  });

  it('autoplay 走的是同一条路：直接送他最在意的那一样，一次就成', () => {
    const state = favorStart();
    const gift = wantedGift(level);
    expect(gift).toBeDefined();
    expect(offerFavor(level, state, gift?.id ?? '')).toBe('loved');
    expect(isFavorDone(level, state)).toBe(true);
  });

  it('送错时他说的是关卡里那句 refuseLine（只陈述，不评价）', () => {
    expect(level.refuseLine.length).toBeGreaterThan(0);
    expect(level.refuseLine.length).toBeLessThanOrEqual(24);
  });
});

describe('美人计 · 故事与复习', () => {
  it('两幕：输了先低头 → 先弄清他在意什么；关键抉择在第二幕', () => {
    expect(entry.story.map((beat) => beat.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s2');
    expect(
      entry.keyMoment.options.filter((option) => option.isCanonical).map((option) => option.text),
    ).toEqual(['先看他平时总在看哪一样，再把那一样送上去']);
  });

  it('三十六计的登记信息：第 31 计 · 败战计（第 6 套）；史源按语用本计，并注明《吴越春秋》存疑', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 31, set: 6 });
    expect(entry.dynasty).toBe('春秋');
    expect(entry.yearApprox).toBe(-490);
    expect(entry.figures).toEqual(['勾践', '夫差', '西施']);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toBe('《三十六计·败战计》');
    expect(entry.source.chapter).toContain('美人计');
    expect(entry.source.quote).toContain('兵强者');
    // 战例出处要注明是后世所辑、存疑（方案里的口径）
    expect(entry.source.chapter).toContain('吴越春秋');
    expect(entry.source.chapter).toContain('存疑');
    expect(entry.moral).toContain('送得对');
    expect(entry.game.template).toBe('lure');
    expect(entry.game.stages[0]!.template).toBe('lure');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz[1]!.question).toContain('见面礼');
  });

  it('儿童化：只是送东西、看目光，没有人受伤，也没有一处流血', () => {
    const prose = [
      entry.moral,
      ...entry.story.map((beat) => beat.text + beat.narration),
      ...entry.misconceptions,
      ...entry.quiz.map((question) => question.question + question.explanation),
      entry.keyMoment.reveal,
      ...entry.keyMoment.options.map((option) => option.text + option.hint),
    ].join('');
    for (const word of ['血', '死', '杀', '砍', '打']) expect(prose).not.toContain(word);
    // 落点在"先弄清别人在意什么"，不是"把人怎么样"
    expect(entry.keyMoment.reveal).toContain('先弄清');
    expect(entry.moral).toContain('在意什么');
  });
});

describe('美人计 · schema：这一关必须有解（内容写错不该等孩子玩到一半才发现）', () => {
  it('wants 对不上任何 kind → 直接报错', () => {
    const bad = { ...level, target: { ...level.target, wants: 'jade' } };
    expect(templateSchemas.lure!.safeParse(bad).success).toBe(false);
  });

  it('两样东西 kind 一样 → 直接报错（孩子分不出哪样才是他在意的）', () => {
    const bad = { ...level, gifts: level.gifts.map((gift) => ({ ...gift, kind: 'silk' })) };
    expect(templateSchemas.lure!.safeParse(bad).success).toBe(false);
  });

  it('老模式那两份脚本也照样过（并集登记，谁都不许踩谁）', () => {
    expect(
      templateSchemas.lure!.safeParse({
        mode: 'decoy',
        guard: { x: 375, y: 520, radius: 96 },
        baits: [
          { id: 'b1', x: 150, y: 350, radius: 66, awayMs: 3200 },
          { id: 'b2', x: 375, y: 292, radius: 66, awayMs: 5200 },
        ],
        prize: { x: 560, y: 1000, radius: 100, needMs: 4800 },
        hint: '放个诱饵把他引开',
      }).success,
    ).toBe(true);
    expect(
      templateSchemas.lure!.safeParse({
        mode: 'trade',
        partner: { x: 375, y: 560 },
        offers: [
          { id: 'paper', x: 170, y: 1010, radius: 88, kind: 'paper' },
          { id: 'ink', x: 375, y: 1010, radius: 88, kind: 'ink' },
        ],
        returns: [
          { offerId: 'paper', kind: 'poem', value: 6 },
          { offerId: 'ink', kind: 'couplet', value: 3 },
        ],
        needed: 6,
        hint: '先递一样东西，看他换回什么',
      }).success,
    ).toBe(true);
  });
});

describe('美人计 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('meiren-ji', 'en')!;
    const hint = (merged.game.stages[0]!.levelScript as { hint: string }).hint;
    expect(merged.title).toBe('The Beauty Trap');
    expect(merged.source.book).toBe('The Thirty-Six Stratagems, Desperate Stratagems');
    expect(hint).toBe('Watch what he looks at');
  });
});
