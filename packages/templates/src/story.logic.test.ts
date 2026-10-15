import { describe, expect, it } from 'vitest';
import {
  MAX_NARRATION_MS,
  MIN_NARRATION_MS,
  gateWatchdogMs,
  narrationMs,
  remainingGateMs,
  speechTrusted,
} from './story.logic';

const ZH_SHORT = '有人送给曹操一头大象。';
const ZH_LONG = '很久很久以前，天和地还没有分开。宇宙像一个鸡蛋，盘古就睡在里面，睡了一万八千年才醒过来。';

describe('旁白时长', () => {
  it('空旁白不占时间', () => {
    expect(narrationMs('   ', 'zh-CN')).toBe(0);
  });

  it('越长越久，且夹在上下限之间', () => {
    expect(narrationMs(ZH_LONG, 'zh-CN')).toBeGreaterThan(narrationMs(ZH_SHORT, 'zh-CN'));
    expect(narrationMs('好', 'zh-CN')).toBe(MIN_NARRATION_MS);
    expect(narrationMs('好'.repeat(400), 'zh-CN')).toBe(MAX_NARRATION_MS);
  });

  it('同样长度下英文比中文快（英文按字符算得更宽）', () => {
    const zh = narrationMs('一二三四五六七八九十', 'zh-CN');
    const en = narrationMs('one two three four five six seven eight nine ten', 'zh-CN');
    expect(en).toBeGreaterThan(zh);
    expect(narrationMs('abcdefghijklmnopqrst', 'en')).toBeLessThan(narrationMs('abcdefghijklmnopqrst', 'zh-CN'));
  });
});

describe('念完了算不算数', () => {
  it('念得太快 = 根本没出声', () => {
    expect(speechTrusted(0, 6000)).toBe(false);
    expect(speechTrusted(300, 6000)).toBe(false);
  });

  it('念够了时间就算数', () => {
    expect(speechTrusted(2100, 6000)).toBe(true);
    expect(speechTrusted(6000, 6000)).toBe(true);
  });

  it('短句也要给一个最小可信时间，别被瞬时的 end 骗过去', () => {
    expect(speechTrusted(500, MIN_NARRATION_MS)).toBe(false);
    expect(speechTrusted(900, MIN_NARRATION_MS)).toBe(true);
  });
});

describe('这一幕还要等多久', () => {
  const full = narrationMs(ZH_LONG, 'zh-CN');

  it('真的念完了就立刻放行', () => {
    expect(remainingGateMs(ZH_LONG, 'zh-CN', 'ended', full)).toBe(0);
    expect(remainingGateMs(ZH_LONG, 'zh-CN', 'ended', full + 500)).toBe(0);
  });

  it('念不出来就补足"读一遍"的时间', () => {
    expect(remainingGateMs(ZH_LONG, 'zh-CN', 'unavailable', 0)).toBe(full);
    expect(remainingGateMs(ZH_LONG, 'zh-CN', 'unavailable', 2000)).toBe(full - 2000);
  });

  it('飞快回报 ended 也不算：照样补到读一遍', () => {
    expect(remainingGateMs(ZH_LONG, 'zh-CN', 'ended', 400)).toBe(full - 400);
  });

  it('已经等够了就不再等（永远不会返回负数）', () => {
    expect(remainingGateMs(ZH_SHORT, 'zh-CN', 'unavailable', full + 9000)).toBe(0);
  });

  it('看门狗一定晚于"读一遍"的时间', () => {
    expect(gateWatchdogMs(ZH_LONG, 'zh-CN')).toBeGreaterThan(narrationMs(ZH_LONG, 'zh-CN'));
    expect(gateWatchdogMs(ZH_LONG, 'en')).toBeGreaterThan(narrationMs(ZH_LONG, 'en'));
  });
});
