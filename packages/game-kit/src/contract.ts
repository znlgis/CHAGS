import type { AllusionContent, Locale } from '@chags/content';

export type { Locale };
export { speechLang } from '@chags/content';

export type TemplateId =
  | 'story' | 'substitution' | 'tap' | 'place' | 'aim' | 'quiz' | 'match' | 'order' | 'drag'
  | 'board' | 'timing' | 'react' | 'branch' | 'build' | 'grow'
  | 'sort' | 'trace' | 'wait' | 'beacon'
  | 'mark' | 'split' | 'burrow' | 'butcher';

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
  'card:unlocked': { allusionId: string; cardId: string };
  'session:exit': { reason: 'complete' | 'quit' | 'background'; progress: number };
}

export type SfxKey = 'tap' | 'correct' | 'wrong' | 'splash' | 'unlock' | 'complete';

export interface ReviewState {
  level: number;
  dueAt: number | null;
  lastGrade: 0 | 1 | 2 | 3 | null;
  reviews: number;
}

export interface AllusionProgress {
  allusionId: string;
  stars: 0 | 1 | 2 | 3;
  completions: number;
  lastPlayedAt: number | null;
  review: ReviewState;
}

export const SAVE_SCHEMA_VERSION = 1;

export interface SaveData {
  schemaVersion: number;
  allusions: Record<string, AllusionProgress>;
  updatedAt: number;
}

export interface ProgressStore {
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
}

export interface AudioBus {
  /** iOS / 微信必须由用户手势触发解锁 */
  unlock(): Promise<void>;
  play(key: SfxKey): void;
  /** 指定音高的一声，用于"进度听得见"（例如天越撑越高，音调越高） */
  tone(freq: number, durationMs: number): void;
  /** 语音：按当前语言朗读。将来的真人配音也按 locale 取不同音频文件 */
  speak(text: string, locale: Locale): void;
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
  skipIntro?: boolean;
  autoplay?: boolean;
}

export interface GameContext {
  container: HTMLElement;
  manifest: GameManifest;
  content: AllusionContent;
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
