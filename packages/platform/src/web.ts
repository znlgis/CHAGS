import type {
  AudioBus, LifecycleBus, PlatformServices, ProgressStore, SaveData, SfxKey, Telemetry,
} from '@chags/game-kit';
import { emptySave, migrate } from '@chags/progress';

const DB_NAME = 'chags';
const STORE_NAME = 'kv';
const SAVE_KEY = 'save';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/** IndexedDB 存档；不可用时自动降级为内存（测试 / 隐私模式） */
export function createIdbProgressStore(): ProgressStore {
  let memory: SaveData | null = null;
  const dbPromise = openDb();

  return {
    async load(): Promise<SaveData> {
      const db = await dbPromise;
      if (!db) return memory ?? emptySave(Date.now());
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(SAVE_KEY);
        request.onsuccess = () => resolve(migrate(request.result, Date.now()));
        request.onerror = () => resolve(emptySave(Date.now()));
      });
    },
    async save(data: SaveData): Promise<void> {
      memory = data;
      const db = await dbPromise;
      if (!db) return;
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(data, SAVE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    },
  };
}

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/**
 * 零音频文件的音频总线：音效用 WebAudio 振荡器合成，旁白用浏览器 TTS。
 * 阶段 1 换成真音频时，只改这里，游戏代码一行不动。
 */
export function createWebAudioBus(): AudioBus {
  let audioCtx: AudioContext | null = null;
  let muted = false;

  function context(): AudioContext | null {
    if (audioCtx) return audioCtx;
    const win = window as WebkitWindow;
    const Ctor = window.AudioContext ?? win.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  }

  function tone(freq: number, duration: number, delay = 0, type: OscillatorType = 'sine'): void {
    const ctx = context();
    if (!ctx || muted) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  const patterns: Record<SfxKey, () => void> = {
    tap: () => tone(560, 0.08, 0, 'triangle'),
    correct: () => {
      tone(660, 0.12);
      tone(880, 0.16, 0.1);
    },
    wrong: () => tone(220, 0.2, 0, 'triangle'),
    splash: () => tone(300, 0.25, 0, 'sawtooth'),
    unlock: () => {
      tone(523, 0.12);
      tone(659, 0.12, 0.09);
      tone(784, 0.2, 0.18);
    },
    complete: () => {
      tone(523, 0.14);
      tone(659, 0.14, 0.12);
      tone(784, 0.14, 0.24);
      tone(1046, 0.3, 0.36);
    },
  };

  return {
    async unlock(): Promise<void> {
      const ctx = context();
      if (ctx && ctx.state === 'suspended') await ctx.resume();
      // iOS 上语音合成同样需要一次用户手势内的调用
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.resume();
      }
    },
    play(key: SfxKey): void {
      patterns[key]();
    },
    speak(text: string): void {
      if (muted || typeof speechSynthesis === 'undefined') return;
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      utterance.pitch = 1.05;
      speechSynthesis.speak(utterance);
    },
    stopSpeech(): void {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    setMuted(next: boolean): void {
      muted = next;
      if (muted) this.stopSpeech();
    },
    isMuted(): boolean {
      return muted;
    },
  };
}

export function createVisibilityLifecycle(): LifecycleBus {
  return {
    onPause(cb: () => void): () => void {
      const handler = () => {
        if (document.visibilityState === 'hidden') cb();
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
    onResume(cb: () => void): () => void {
      const handler = () => {
        if (document.visibilityState === 'visible') cb();
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
  };
}

/** 默认不采集任何信息，只在本地留一份事件轨迹，方便调试与将来做家长报告 */
export function createLocalTelemetry(): Telemetry {
  const buffer: { type: string; at: number }[] = [];
  return {
    track(type): void {
      buffer.push({ type, at: Date.now() });
      if (buffer.length > 500) buffer.shift();
    },
    async flush(): Promise<void> {
      // 刻意不发送：儿童产品默认不上报
    },
  };
}

export function createWebPlatform(): PlatformServices {
  return {
    storage: createIdbProgressStore(),
    audio: createWebAudioBus(),
    lifecycle: createVisibilityLifecycle(),
    async share(opts): Promise<void> {
      const nav = navigator as Navigator & { share?: (data: { title: string; text: string; url?: string }) => Promise<void> };
      if (typeof nav.share === 'function') {
        await nav.share({ title: opts.title, text: opts.text, url: opts.url });
      }
    },
    telemetry: createLocalTelemetry(),
    now: () => Date.now(),
  };
}
