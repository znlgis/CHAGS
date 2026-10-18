import type { ContentEntry } from './schema';

/**
 * 取某条内容里某个模板的阶段脚本；缺了就早失败，别等玩到一半才发现。
 *
 * 这个函数以前住在 `entries/detail.ts`（"完整内容"那一层），于是 53 个游戏包的
 * `logic.ts` 为了调它去 import '@chags/content/full' —— 结果每个游戏 chunk 都静态
 * 拖上"全部 53 条详情"的那个大 chunk（83 KB gzip）。它其实只需要 ContentEntry，
 * 不需要任何一条具体内容，所以搬到摘要层（外壳入口）里来。
 */
export function stageScript(content: ContentEntry, template: string): unknown {
  const stage = content.game.stages.find((s) => s.template === template);
  if (!stage) {
    throw new Error('内容 ' + content.id + ' 缺少 ' + template + ' 阶段脚本');
  }
  return stage.levelScript;
}
