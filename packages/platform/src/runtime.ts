/**
 * 运行环境探测：同一份站点产物会被三种壳加载 ——
 * 浏览器（含 PWA）、Tauri 桌面壳、Capacitor 安卓壳。
 *
 * 这里**不 import 任何壳的 SDK**：原生插件全部通过运行时桥接对象取用，
 * 好处是 Web 包体积零增长，也不会有插件在浏览器里报错。
 */
export type RuntimeKind = 'web' | 'tauri' | 'capacitor';

export interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}

interface RuntimeWindow extends Window {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
  Capacitor?: CapacitorGlobal;
}

export function capacitor(): CapacitorGlobal | undefined {
  return (window as RuntimeWindow).Capacitor;
}

export function detectRuntime(): RuntimeKind {
  const w = window as RuntimeWindow;
  if (w.__TAURI_INTERNALS__ !== undefined || w.__TAURI__ !== undefined) return 'tauri';
  if (w.Capacitor?.isNativePlatform?.() === true) return 'capacitor';
  return 'web';
}

export function isNativeRuntime(): boolean {
  return detectRuntime() !== 'web';
}

export interface NativeTextToSpeech {
  speak(options: {
    text: string;
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    category?: string;
  }): Promise<void>;
  stop(): Promise<void>;
}

/**
 * 安卓系统 TTS（@capacitor-community/text-to-speech 注册到桥上）。
 * 必须走原生：**Android WebView 没有实现 Web Speech API**，
 * 只靠 speechSynthesis 的话，安卓版会全程没有旁白。
 */
export function nativeTextToSpeech(): NativeTextToSpeech | null {
  const plugin = capacitor()?.Plugins?.['TextToSpeech'];
  return (plugin as NativeTextToSpeech | undefined) ?? null;
}

export interface NativeApp {
  addListener(event: 'backButton', callback: () => void): void;
  exitApp(): Promise<void>;
}

export function nativeApp(): NativeApp | null {
  const plugin = capacitor()?.Plugins?.['App'];
  return (plugin as NativeApp | undefined) ?? null;
}
