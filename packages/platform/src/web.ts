import { speechLang } from '@chags/game-kit';
import type {
  AudioBus, LifecycleBus, Locale, PlatformServices, ProgressStore, SaveData, SfxKey,
  SpeechHandle, SpeechOutcome, Telemetry,
} from '@chags/game-kit';
import { emptySave, migrate } from '@chags/progress';
import { nativeTextToSpeech } from './runtime';

const DB_NAME = 'chags';
const STORE_NAME = 'kv';
const SAVE_KEY = 'save';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    // 隐私模式、存储被禁、旧标签页占着升级（onblocked）都会让 open 永不回调：
    // 超时就退内存档，绝不让启动流程挂在这里等（以前 init 会永远 pending）
    const timer = setTimeout(() => resolve(null), 3000);
    const request = indexedDB.open(DB_NAME, 1);
    const settle = (db: IDBDatabase | null): void => {
      clearTimeout(timer);
      resolve(db);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => settle(request.result);
    request.onerror = () => settle(null);
    request.onblocked = () => settle(null);
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
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const request = tx.objectStore(STORE_NAME).get(SAVE_KEY);
          request.onsuccess = () => {
            try {
              resolve(migrate(request.result, Date.now()));
            } catch {
              // 读档本身出错也不能卡住启动（migrate 已对坏数据逐条兜底）
              resolve(emptySave(Date.now()));
            }
          };
          request.onerror = () => resolve(emptySave(Date.now()));
        } catch {
          resolve(emptySave(Date.now()));
        }
      });
    },
    async save(data: SaveData): Promise<void> {
      memory = data;
      const db = await dbPromise;
      if (!db) return;
      // ★ 写失败必须让调用方知道（配额满 / 无痕模式 / 存储被清）：
      // 以前 onerror 也 resolve，等于把"进度没存上"静默吞掉
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(data, SAVE_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('存档写入失败'));
          tx.onabort = () => reject(tx.error ?? new Error('存档写入被中止'));
        } catch (cause) {
          reject(cause instanceof Error ? cause : new Error(String(cause)));
        }
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
    tone(freq: number, durationMs: number): void {
      tone(freq, durationMs / 1000, 0, 'triangle');
    },
    /**
     * 朗读。句柄的 done 在"念完"或"确认念不出来"时 resolve ——
     * 故事页靠它兑现"听完才能继续"，玩法里的旁白则直接忽略返回值。
     * 注意：静音、没有语音包、无头浏览器都必须走 unavailable 这一路，
     * 绝不能既不 resolve 又不报错（那会把故事页永远钉住）。
     */
    speak(text: string, locale: Locale): SpeechHandle {
      if (muted) return { done: Promise.resolve('unavailable') };

      // ① 原生 TTS（安卓）：WebView 没有 Web Speech API，必须走系统语音
      const native = nativeTextToSpeech();
      if (native) {
        const done = native
          .speak({
            text,
            lang: speechLang(locale),
            rate: locale === 'en' ? 0.95 : 0.9,
            pitch: 1.05,
            // 0.8 而不是 1.0：孩子的设备常在耳边/公交上，满音量容易过响、也容易吓一跳
            volume: 0.8,
          })
          .then((): SpeechOutcome => 'ended')
          // 安卓设备没装语音包时会失败；静默降级，绝不让游戏卡住
          .catch((): SpeechOutcome => 'unavailable');
        return { done };
      }

      // ② Web Speech API（桌面 WebView2 / 浏览器）
      if (typeof speechSynthesis === 'undefined') {
        return { done: Promise.resolve('unavailable') };
      }
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLang(locale);
      utterance.rate = locale === 'en' ? 0.95 : 0.9;
      utterance.pitch = 1.05;
      // 与原生 TTS 口径一致：0.8 足够听清，又不会在耳边炸响
      utterance.volume = 0.8;
      // 切语言时优先挑该语言的嗓音，没有就用系统默认
      const voices = speechSynthesis.getVoices();
      const match = voices.find((v) => v.lang.toLowerCase().startsWith(locale === 'en' ? 'en' : 'zh'));
      if (match) utterance.voice = match;
      const done = new Promise<SpeechOutcome>((resolve) => {
        // 只认第一个结果：cancel() 也可能把这一条打成 error
        let settled = false;
        const settle = (outcome: SpeechOutcome): void => {
          if (settled) return;
          settled = true;
          resolve(outcome);
        };
        utterance.onend = () => settle('ended');
        utterance.onerror = () => settle('unavailable');
        speechSynthesis.speak(utterance);
      });
      return { done };
    },
    stopSpeech(): void {
      const native = nativeTextToSpeech();
      if (native) {
        void native.stop().catch(() => undefined);
        return;
      }
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
  // 移动端存储压力下浏览器可能清掉 IndexedDB：能申请"持久存储"就申请一次。
  // 失败（不支持 / 用户拒绝）不影响功能，只是少了这层保险。
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    void navigator.storage.persist();
  }
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
