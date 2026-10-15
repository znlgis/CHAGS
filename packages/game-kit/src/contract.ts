import type { ContentEntry, Locale } from '@chags/content';

export type { Locale };
export { speechLang } from '@chags/content';

export type TemplateId =
  | 'story' | 'substitution' | 'tap' | 'place' | 'aim' | 'quiz' | 'match' | 'order' | 'drag'
  | 'board' | 'timing' | 'react' | 'branch' | 'build' | 'grow'
  | 'sort' | 'trace' | 'wait' | 'beacon'
  | 'mark' | 'split' | 'burrow' | 'butcher'
  // 三十六计：示形 / 要害 / 借力 / 忍 / 时机窗口
  | 'ruse' | 'siege' | 'borrow' | 'stillness' | 'window'
  // 三十六计第二辑：造势 / 双线 / 识破 / 配对编排
  | 'show' | 'twoline' | 'read' | 'matchup';

export interface GameManifest {
  id: string;
  title: string;
  version: string;
  template: TemplateId;
  orientation: 'portrait' | 'landscape';
  designSize: { width: number; height: number };
  ageRange: [number, number];
  sessionSeconds: [number, number];
  skills: string[];
  curriculum: { dynasty: string; yearApprox?: number; figures: string[] };
  assets: { cover: string };
}

export interface GameEventMap {
  'session:start': { at: number };
  'scene:enter': { scene: string };
  'beat:enter': { beatId: string };
  /** 这一幕的旁白真的听完了 —— 故事页的小手到这一刻才出现 */
  'story:ready': { beatId: string };
  'choice:made': { beatId: string; choiceId: string; correct: boolean; latencyMs: number };
  'hint:used': { beatId: string; level: number };
  'level:complete': {
    levelId: string;
    stars: 0 | 1 | 2 | 3;
    mistakes: number;
    correct: number;
    total: number;
    durationMs: number;
  };
  'card:unlocked': { entryId: string; cardId: string };
  'session:exit': { reason: 'complete' | 'quit' | 'background'; progress: number };
}

export type SfxKey = 'tap' | 'correct' | 'wrong' | 'splash' | 'unlock' | 'complete';

export interface ReviewState {
  level: number;
  dueAt: number | null;
  lastGrade: 0 | 1 | 2 | 3 | null;
  reviews: number;
}

export interface EntryProgress {
  entryId: string;
  stars: 0 | 1 | 2 | 3;
  completions: number;
  lastPlayedAt: number | null;
  review: ReviewState;
}

export const SAVE_SCHEMA_VERSION = 1;

export interface SaveData {
  schemaVersion: number;
  /**
   * 每条内容的进度，键是内容 id。
   * **字段名刻意保留 `allusions`**：改名会让所有老存档读不出来 ——
   * 玩家的星星不能因为一次重命名凭空消失。
   * 内容侧的重命名（allusions → entries）只动类型与目录，不动这里。
   */
  allusions: Record<string, EntryProgress>;
  updatedAt: number;
}

export interface ProgressStore {
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
}

/** 朗读的结果：真的念完了 / 这台设备念不出来（静音、没装语音包、无头浏览器） */
export type SpeechOutcome = 'ended' | 'unavailable';

export interface SpeechHandle {
  /**
   * 念完、或者确认念不出来时 resolve —— 两种情况都必须 resolve，
   * 否则故事页会永远停在"正在听"上。玩法里的旁白可以完全忽略它。
   */
  readonly done: Promise<SpeechOutcome>;
}

export interface AudioBus {
  /** iOS / 微信必须由用户手势触发解锁 */
  unlock(): Promise<void>;
  play(key: SfxKey): void;
  /** 指定音高的一声，用于"进度听得见"（例如天越撑越高，音调越高） */
  tone(freq: number, durationMs: number): void;
  /** 语音：按当前语言朗读。将来的真人配音也按 locale 取不同音频文件 */
  speak(text: string, locale: Locale): SpeechHandle;
  stopSpeech(): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

export interface LifecycleBus {
  onPause(cb: () => void): () => void;
  onResume(cb: () => void): () => void;
}

export interface ShareOptions {
  title: string;
  text: string;
  url?: string;
}

export interface Telemetry {
  track<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void;
  flush(): Promise<void>;
}

/** 唯一的平台出口：游戏不许直接碰 localStorage / fetch / wx.* */
export interface PlatformServices {
  storage: ProgressStore;
  audio: AudioBus;
  lifecycle: LifecycleBus;
  share(opts: ShareOptions): Promise<void>;
  telemetry: Telemetry;
  now(): number;
}

export interface DebugOptions {
  seed?: string;
  autoplay?: boolean;
  /**
   * ?story=instant（自动化截图用）：跳过故事页"听完才能继续"的等待。
   * 玩家在界面上拿不到这个开关，只有 URL 参数能给。
   */
  storyInstant?: boolean;
  /**
   * ?card=hold（双语版面巡检用）：自动通关照跑，但**停在典故卡上**不自动返回。
   * 自动通关下卡片只停 200ms，卡面（双语长标题 / 出处 / 关键词）的版面拍不到 ——
   * 三十六计每个游戏的卡面都靠它巡检。玩家界面上同样没有这个开关。
   */
  cardHold?: boolean;
}

export interface GameContext {
  container: HTMLElement;
  manifest: GameManifest;
  content: ContentEntry;
  services: PlatformServices;
  locale: Locale;
  reducedMotion: boolean;
  debug?: DebugOptions;
  emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void;
  requestExit(): void;
}

export interface GameModule {
  manifest: GameManifest;
  mount(ctx: GameContext): Promise<void>;
  unmount(): Promise<void>;
  pause(): void;
  resume(): void;
}
