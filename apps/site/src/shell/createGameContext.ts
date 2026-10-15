import { getAllusion } from '@chags/content';
import type { Locale } from '@chags/content';
import type { DebugOptions, GameContext, GameEventMap, GameManifest } from '@chags/game-kit';
import { recordDebugEvent } from './debug';
import { platform } from './platform';

export interface GameHostHooks {
  onExit: () => void;
  onEvent: <K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]) => void;
}

/** ?autoplay=1&seed=xxx —— 无头直达的调试开关 */
export function readDebugOptions(): DebugOptions | undefined {
  const params = new URLSearchParams(window.location.search);
  const autoplay = params.get('autoplay') === '1';
  const seed = params.get('seed');
  // ?story=instant：截图巡检专用，跳过"听完才能继续"的等待（玩家界面上没有这个开关）
  const storyInstant = params.get('story') === 'instant';
  if (!autoplay && !seed && !storyInstant) return undefined;
  const options: DebugOptions = {};
  if (autoplay) options.autoplay = true;
  if (storyInstant) options.storyInstant = true;
  if (seed !== null && seed.length > 0) options.seed = seed;
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

export function createGameContext(
  manifest: GameManifest,
  container: HTMLElement,
  locale: Locale,
  hooks: GameHostHooks,
): GameContext {
  // 关键：交给游戏的是**已经翻译好**的内容，游戏本身不需要知道语言的存在
  const content = getAllusion(manifest.id, locale);
  if (!content) throw new Error('找不到典故内容：' + manifest.id);

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
