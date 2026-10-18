import { entrySummaries } from './entries';
import { patchFor } from './i18n';
import { DEFAULT_LOCALE } from './locale';
import type { Locale } from './locale';
import { mergeLocalized } from './localize';
import type { ContentEntry } from './schema';

/**
 * 外壳专用：**按条目**动态加载一条完整内容（摘要 + 详情 + 当前语言译文）。
 *
 * - 只有这里 import('./entries/loaders')：Vite 给每个条目切一个 chunk，
 *   打开一局只下自己那 1–2 KB（以前是一个 83.4 KB gzip、装着全部 53 条的 chunk）；
 * - 英文详情补丁只在该语言下才加载 —— 中文用户不下载它们（约占旧 chunk 的 46%）；
 * - Node 侧（content:check / 单测）走 '@chags/content/full' 的同步全量入口，不经过这里。
 */
export async function loadEntry(id: string, locale: Locale): Promise<ContentEntry | undefined> {
  const summary = entrySummaries.find((entry) => entry.id === id);
  if (summary === undefined) return undefined;

  const { loadDetail, loadDetailPatch } = await import('./entries/loaders');
  const detail = await loadDetail(id);
  let content: ContentEntry = { ...summary, ...detail };
  if (locale === DEFAULT_LOCALE) return content;

  const summaryPatch = patchFor(locale, id);
  if (summaryPatch !== undefined) content = mergeLocalized(content, summaryPatch);
  const detailPatch = await loadDetailPatch(id);
  if (detailPatch !== undefined) content = mergeLocalized(content, detailPatch);
  return content;
}
