import { loadEntry } from '@chags/content';
import type { Locale } from '@chags/content';
import type { DebugOptions, GameContext, GameEventMap, GameManifest } from '@chags/game-kit';
import { recordDebugEvent } from './debug';
import { platform } from './platform';

export interface GameHostHooks {
  onExit: () => void;
  onEvent: <K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]) => void;
}

/** ?autoplay=1 —— 无头直达的调试开关（?story=instant、?card=hold 同理） */
export function readDebugOptions(): DebugOptions | undefined {
  const params = new URLSearchParams(window.location.search);
  const autoplay = params.get('autoplay') === '1';
  // ?story=instant：截图巡检专用，跳过"听完才能继续"的等待（玩家界面上没有这个开关）
  const storyInstant = params.get('story') === 'instant';
  // ?card=hold：截图巡检专用，自动通关后停在典故卡上（同上，只有 URL 能给）
  const cardHold = params.get('card') === 'hold';
  if (!autoplay && !storyInstant && !cardHold) return undefined;
  const options: DebugOptions = {};
  if (autoplay) options.autoplay = true;
  if (storyInstant) options.storyInstant = true;
  if (cardHold) options.cardHold = true;
  return options;
}

/** 事件细节：调试桥和 e2e 都靠它区分"哪一个场景 / 哪一个选择" */
function detailOf<K extends keyof GameEventMap>(
  type: K,
  payload: GameEventMap[K],
): string | undefined {
  if (type === 'scene:enter') return (payload as GameEventMap['scene:enter']).scene;
  if (type === 'choice:made') return (payload as GameEventMap['choice:made']).choiceId;
  if (type === 'beat:enter') return (payload as GameEventMap['beat:enter']).beatId;
  if (type === 'story:ready') return (payload as GameEventMap['story:ready']).beatId;
  return undefined;
}

/**
 * ★ 异步：完整内容（故事 / 复习题 / 关卡脚本）是**动态加载**的。
 * 大厅只需要摘要，这一层 import() 让 Vite 把完整内容切成懒加载 chunk ——
 * 首屏因此不再为渲染卡片把 35 条关卡脚本一起下下来。
 */
export async function createGameContext(
  manifest: GameManifest,
  container: HTMLElement,
  locale: Locale,
  hooks: GameHostHooks,
): Promise<GameContext> {
  // 关键：交给游戏的是**已经翻译好**的内容，游戏本身不需要知道语言的存在
  const content = await loadEntry(manifest.id, locale);
  if (!content) throw new Error('找不到游戏内容：' + manifest.id);

  return {
    container,
    manifest,
    content,
    services: platform,
    locale,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    debug: readDebugOptions(),
    emit(type, payload) {
      platform.telemetry.track(type, payload);
      recordDebugEvent(type, detailOf(type, payload));
      hooks.onEvent(type, payload);
    },
    requestExit() {
      hooks.onExit();
    },
  };
}
