/**
 * `@chags/content`（外壳侧）：**只有摘要**。
 *
 * 大厅、图鉴、注册表用这里的 API；完整内容（故事 / 复习题 / 关卡脚本）走
 * `loadEntry()`（动态 import）或子路径 `@chags/content/full`（游戏包与内容体检用）。
 * 外壳一旦直接 import '@chags/content/full'，懒加载就白做了 —— 首屏会重新变大。
 */
export * from './locale';
export * from './groups';
export * from './localize';
export * from './schema';
export * from './i18n';
export * from './entries';
export { loadEntry } from './loadEntry';
