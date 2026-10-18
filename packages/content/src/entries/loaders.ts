import type { EntryDetail } from '../schema';

/**
 * 浏览器侧的**按条目**内容加载器（Vite 会把每个 JSON 切成一个独立 chunk）。
 *
 * 这个模块只在 `loadEntry()` 里被动态 import，所以：
 * - 浏览器：Vite 用 import.meta.glob 生成"每个条目一个 loader"的映射表；
 * - Node（content:check / 单测）：根本不会 import 它（那边用 entries/detail.ts 的同步全量入口）。
 *
 * 为什么值得拆：以前 loadEntry 只有一次 `import('./entries/detail')`，
 * Vite 把 53 条中文详情 + 53 条英文详情补丁打进同一个 chunk（83.4 KB gzip），
 * 打开任何一局都要把**全部**内容下下来；现在单局只下自己那 1–2 KB。
 */
const DETAIL = import.meta.glob<{ default: EntryDetail }>('./*.game.json');
const EN_DETAIL = import.meta.glob<{ default: unknown }>('../i18n/en/*.game.json');

export async function loadDetail(id: string): Promise<EntryDetail> {
  const loader = DETAIL['./' + id + '.game.json'];
  if (loader === undefined) throw new Error('找不到内容详情：' + id);
  return (await loader()).default;
}

export async function loadDetailPatch(id: string): Promise<unknown> {
  const loader = EN_DETAIL['../i18n/en/' + id + '.game.json'];
  if (loader === undefined) return undefined;
  return (await loader()).default;
}
