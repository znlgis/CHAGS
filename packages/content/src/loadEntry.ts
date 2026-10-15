import type { Locale } from './locale';
import type { ContentEntry } from './schema';

/**
 * 外壳专用：**动态**加载一条完整内容（摘要 + 详情）。
 *
 * 这里刻意只有一次 import()：Vite 会把 `./entries/detail`（35 条内容的故事、复习题与关卡脚本）
 * 切成一个懒加载 chunk，首屏只剩摘要层。
 * 直接 import '@chags/content/full' 会让这些内容**回到首屏**——外壳不要那么做。
 */
export async function loadEntry(id: string, locale: Locale): Promise<ContentEntry | undefined> {
  const mod = await import('./entries/detail');
  return mod.getEntry(id, locale);
}
