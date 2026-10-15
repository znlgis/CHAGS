import type { Locale } from '@chags/content';
import type { SpeechOutcome } from '@chags/game-kit';

/**
 * "听完故事才能往下走"的算法 —— 纯函数，可以脱离浏览器单测。
 *
 * 两种设备都要兜住：
 * - 有语音：等它真的念完；
 * - 没有语音（静音 / 没装语音包 / 无头浏览器）：按"读一遍"的时间等 ——
 *   否则"听完才能继续"在这些设备上等于没有。
 */
const CHARS_PER_SECOND: Record<Locale, number> = { 'zh-CN': 5, en: 14 };
/** 再短的一句也要停一下：孩子得有时间把画面和这句话对上 */
export const MIN_NARRATION_MS = 2200;
/** 再长的旁白也有上限：卡住比念不完更糟 */
export const MAX_NARRATION_MS = 24000;

/** 这段话"念一遍"大概要多久；没有语音可用时，它就是这一幕的最低停留时间 */
export function narrationMs(text: string, locale: Locale): number {
  const chars = text.trim().length;
  if (chars === 0) return 0;
  const speed = CHARS_PER_SECOND[locale] ?? CHARS_PER_SECOND['zh-CN'];
  const raw = (chars / speed) * 1000;
  return Math.round(Math.min(MAX_NARRATION_MS, Math.max(MIN_NARRATION_MS, raw)));
}

/**
 * "念完了"这件事可不可信。
 * 无头浏览器、没装语音包的机器、刚被 cancel 掉的朗读都会**立刻**回报结束 ——
 * 那不是听完了，是根本没出声，所以不能算数。
 */
export function speechTrusted(elapsedMs: number, fullMs: number): boolean {
  return elapsedMs >= Math.min(Math.max(fullMs * 0.35, 900), 4000);
}

/** 这一幕还要等多久才能翻页（0 = 现在就可以翻） */
export function remainingGateMs(
  text: string,
  locale: Locale,
  outcome: SpeechOutcome,
  elapsedMs: number,
): number {
  const full = narrationMs(text, locale);
  if (outcome === 'ended' && speechTrusted(elapsedMs, full)) return 0;
  return Math.max(0, full - elapsedMs);
}

/** 兜底看门狗：语音引擎迟迟不回报时，超过它就按"念不出来"处理，绝不把孩子钉在这一幕 */
export function gateWatchdogMs(text: string, locale: Locale): number {
  return Math.round(narrationMs(text, locale) * 1.8) + 2500;
}
