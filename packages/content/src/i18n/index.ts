import { DEFAULT_LOCALE } from '../locale';
import type { Locale } from '../locale';

/**
 * 摘要译文补丁（当前只有英文）。**按语言懒加载**：
 * 53 份 en 补丁约 9 KB gzip，而默认语言（中文）永远用不到它们，
 * 所以中文用户的首页不该为它们付钱（以前是静态 import，全量进首屏）。
 *
 * Node 侧（content:check / 单测）走 '@chags/content/full'：
 * 那边同步注册全量补丁（见 entries/detail.ts），所以路径行为不变。
 */
let loaded: Partial<Record<Locale, Record<string, unknown>>> = {};

/** Node 侧同步注册（'@chags/content/full' 专用；浏览器不要调） */
export function registerPatches(patches: Partial<Record<Locale, Record<string, unknown>>>): void {
  loaded = { ...loaded, ...patches };
}

export function patchFor(locale: Locale, id: string): unknown {
  if (locale === DEFAULT_LOCALE) return undefined;
  return loaded[locale]?.[id];
}

/**
 * 切到某个语言之前，先把该语言的摘要补丁加载好（默认语言直接返回）。
 * 只加载一次；失败就回落到中文文案，不能让切语言把界面搞挂。
 */
export async function ensurePatches(locale: Locale): Promise<void> {
  if (locale === DEFAULT_LOCALE || loaded[locale] !== undefined) return;
  try {
    const mod = await import('./en');
    loaded = { ...loaded, en: mod.patches };
  } catch {
    // 加载失败：patchFor 返回 undefined → 界面回落中文
  }
}
