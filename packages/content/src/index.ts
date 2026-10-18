/**
 * `@chags/content`（外壳侧）：**只有摘要**。
 *
 * 大厅、图鉴、注册表用这里的 API；完整内容（故事 / 复习题 / 关卡脚本）走
 * `loadEntry()`（按条目动态 import）或子路径 `@chags/content/full`（Node 侧 CLI 与测试用）。
 * 外壳一旦直接 import '@chags/content/full'，懒加载就白做了 —— 首屏会重新变大。
 *
 * ★ 这里**刻意不导出** schema.ts 的运行时对象（EntrySummarySchema 等）：
 * `z.object(...)` 是真实副作用，只要这个入口引用 schema.ts，zod 就会跟着进首屏
 * （实测 24.7 KB gzip / 首屏的 29%）。需要 zod 的地方走 '@chags/content/full'。
 */
export * from './locale';
export * from './groups';
export * from './localize';
export * from './i18n';
export * from './entries';
export * from './split';
export { stageScript } from './stage';
export { loadEntry } from './loadEntry';

export type {
  ContentEntry,
  EntryDetail,
  EntrySummary,
  GameStage,
  KeyMoment,
  KeyMomentOption,
  QuizQuestion,
  StoryBeat,
  Stratagem,
  TemplateId,
} from './schema';
