import { getEntry } from '@chags/content/full';
import { describe, expect, it } from 'vitest';
import { bestOffer, give, isTradeDone, offerFor, tradeStart } from '@chags/templates/lure.logic';
import {
  OFFER_RADIUS, OFFER_XS, PARTNER, RETURN_AT, TABLE_Y, VERSE_XS, WALL_BOTTOM, WALL_TOP,
} from './layout';
import { lureLevel } from './logic';

const entry = getEntry('paozhuan-yinyu')!;
const level = lureLevel(entry);
if (level.mode !== 'trade') throw new Error('第 17 计 · 抛砖引玉是 trade（先给一块砖）');
const trade = level;

describe('抛砖引玉 · 关卡数据与美术互锁', () => {
  it('三样东西摆在案上 —— 美术画的案就是关卡数据里的横坐标', () => {
    expect(trade.offers.map((offer) => offer.id)).toEqual(['paper', 'ink', 'brush']);
    expect(trade.offers.map((offer) => offer.x)).toEqual([...OFFER_XS]);
    expect(trade.offers.map((offer) => offer.kind)).toEqual(['paper', 'ink', 'brush']);
    for (const offer of trade.offers) {
      expect(offer.y).toBe(TABLE_Y);
      expect(offer.radius).toBe(OFFER_RADIUS);
    }
    // 三样东西要排在一列上，而且互不重叠（手指粗也不会点错）
    expect(trade.offers[0]!.x + OFFER_RADIUS).toBeLessThan(trade.offers[1]!.x - OFFER_RADIUS + 1);
    expect(trade.offers[1]!.x + OFFER_RADIUS).toBeLessThan(trade.offers[2]!.x - OFFER_RADIUS + 1);
  });

  it('对方站在案前、题诗的墙下 —— 换回来的时候东西飘在他手边', () => {
    expect(trade.partner.x).toBe(PARTNER.x);
    expect(trade.partner.y).toBe(PARTNER.y);
    expect(trade.partner.y).toBeLessThan(TABLE_Y);
    expect(trade.partner.y).toBeGreaterThan(WALL_BOTTOM); // 站在墙前面，不挡住那两句诗
    expect(RETURN_AT.x).toBeGreaterThan(trade.partner.x); // 他拿出来的东西在右手边
    expect(RETURN_AT.x + 90).toBeLessThan(750); // 而且整张诗笺都在画面里
    expect(RETURN_AT.y).toBeLessThan(PARTNER.y); // 飘在他手边（比肩膀高一点）
    // 墙上写着一列"换回来的好句"的地方
    expect(VERSE_XS[2]).toBeGreaterThan(VERSE_XS[0]!);
    expect(WALL_TOP).toBeLessThan(WALL_BOTTOM);
  });
});

describe('抛砖引玉 · 一局真的走得完（照模板 runAutoplay 的同一条路）', () => {
  it('三块砖都查得到换回什么，最不起眼的那块（纸）换回最多', () => {
    for (const offer of trade.offers) {
      expect(offerFor(trade, offer.id)?.offerId).toBe(offer.id);
    }
    expect(trade.returns.map((item) => item.value)).toEqual([6, 3, 2]);
    expect(trade.needed).toBe(6);
    expect(bestOffer(trade)?.id).toBe('paper');
    expect(offerFor(trade, 'paper')?.kind).toBe('poem');
  });

  it('挑错了只是再挑一次：换回三分的墨不算成，换上纸就成了', () => {
    let state = give(trade, tradeStart(), 'ink');
    expect(isTradeDone(trade, state)).toBe(false);
    expect(state.best).toBe(3);
    state = give(trade, state, 'paper');
    expect(isTradeDone(trade, state)).toBe(true);
    expect(state.gives).toBe(2);
    expect(state.lastReturn?.kind).toBe('poem');
  });

  it('一块砖递两次也照样能成（不是刷分，也不是惩罚）', () => {
    const once = give(trade, tradeStart(), 'brush');
    const twice = give(trade, once, 'brush');
    expect(twice.gives).toBe(2);
    expect(twice.best).toBe(2);
    expect(isTradeDone(trade, twice)).toBe(false);
    expect(isTradeDone(trade, give(trade, twice, 'paper'))).toBe(true);
  });
});

describe('抛砖引玉 · 内容', () => {
  it('故事两幕：墙上只有两句 → 常建先写下自己那两句；关键抉择在第一幕', () => {
    expect(entry.story.map((b) => b.id)).toEqual(['s1', 's2']);
    expect(entry.keyMoment.beatId).toBe('s1');
    expect(entry.keyMoment.options.filter((o) => o.isCanonical).map((o) => o.text)).toEqual([
      '先在墙上写下自己那两句',
    ]);
    expect(entry.story[1]!.text).toContain('补出了后面的好句');
  });

  it('儿童化：书斋题诗，是文人的典故，没有打斗', () => {
    const text = JSON.stringify(entry);
    expect(text).not.toContain('血');
    expect(entry.moral).toContain('先给一点点');
    expect(entry.figures).toEqual(['常建', '赵嘏']);
  });

  it('三十六计的登记信息：第 17 计、攻战计（第三套）；史源用按语', () => {
    expect(entry.group).toBe('stratagem');
    expect(entry.kind).toBe('strategy');
    expect(entry.stratagem).toEqual({ number: 17, set: 3 });
    expect(entry.yearApprox).toBe(800);
    expect(entry.ageRange).toEqual([8, 12]);
    expect(entry.source.book).toContain('三十六计');
    expect(entry.source.chapter).toBe('抛砖引玉');
    expect(entry.source.quote).toBe('类以诱之，击蒙也。');
    expect(entry.game.template).toBe('lure');
    expect(entry.game.stages[0]!.template).toBe('lure');
  });

  it('复习题：有记忆题也有迁移题', () => {
    expect(entry.quiz.filter((q) => q.kind === 'transfer')).toHaveLength(1);
  });
});

describe('抛砖引玉 · 英译补丁', () => {
  it('英文文案（结构 / 漏翻 / 模板合法性由 content:check 守）', () => {
    const merged = getEntry('paozhuan-yinyu', 'en')!;
    expect(merged.title).toBe('Cast a Brick to Attract Jade');
  });
});
