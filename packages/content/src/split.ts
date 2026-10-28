import type { ContentEntry, EntryDetail, EntrySummary } from './schema';

/**
 * 摘要字段 / 详情字段的键（顺序与 schema 里一致）。
 * 与 schema.ts 分开的原因见 index.ts：schema.ts 会执行 z.object(...)（真实副作用），
 * 一旦被外壳入口再导出，zod 就会跟着进首屏。
 */
export const SUMMARY_KEYS = [
  'id', 'group', 'kind', 'title', 'pinyin', 'dynasty', 'era', 'yearApprox', 'source', 'moral',
  'keywords', 'ageRange', 'stratagem',
  // 2026-10-18 适龄内容修订新增的两个摘要字段（schema.ts 已登记）：
  // 漏在这里的话，content:check 会把英文补丁里的它们判成"原文里没有这个字段"
  'transfer', 'thinkingTag',
] as const;

export const DETAIL_KEYS = [
  'figures', 'story', 'keyMoment', 'misconceptions', 'quiz', 'game',
] as const;

/**
 * 把一条完整内容拆成摘要与详情 —— **字段划分只写在这一处**：
 * 拆文件的脚本、内容体检、译文补丁校验都从这里拿规则，免得三处各写一份然后走样。
 */
export function splitEntry(entry: ContentEntry): { summary: EntrySummary; detail: EntryDetail } {
  const source = entry as unknown as Record<string, unknown>;
  const pick = <T,>(keys: readonly string[]): T => {
    const out: Record<string, unknown> = {};
    for (const key of keys) if (key in source) out[key] = source[key];
    return out as T;
  };
  return {
    summary: pick<EntrySummary>(SUMMARY_KEYS),
    detail: pick<EntryDetail>(DETAIL_KEYS),
  };
}
