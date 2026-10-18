/**
 * 模板包的核心入口：**每个游戏都要的那一点点**。
 *
 * 以前 53 个游戏都从 '@chags/templates' 这个大 barrel 里取 defineGame / SCENE_KEYS / 场景工厂，
 * barrel 又把 24 个模板场景全部再导出 —— 打包器因此把**全部场景**放进共享 chunk：
 * 打开任意一局都要下约 90 KB gzip 的模板代码，而它其实只用到其中 1–2 个场景。
 *
 * 现在分两档：
 * - 核心（这里）：defineGame + 布局常量 + 一局状态 —— 每局都需要的公共部分；
 * - 场景：'@chags/templates/<id>' 子路径，一个游戏只 import 自己用到的。
 * 主 barrel 仍然保留（Node 侧测试与类型用），但游戏包的**运行时** import 已改走子路径。
 */
export { defineGame } from './defineGame';
export type { GameDefinition, GameplayStage } from './defineGame';
export * from './layout';
export * from './session';
