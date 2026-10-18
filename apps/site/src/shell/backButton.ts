import { nativeApp } from '@chags/platform';
import { navigate } from '../router';
import type { Route } from '../router';
import type { Ref } from 'vue';

/**
 * 原生壳（Capacitor / Tauri）返回键桥的最小接口 —— 只用到这两个方法。
 *
 * 抽成接口是为了**能单测**：浏览器里没有原生壳，以前这条路径 0 覆盖，
 * 直到真机上误按返回键把游戏关掉才会发现。
 */
export interface BackBridge {
  addListener(event: 'backButton', callback: () => void): void;
  exitApp(): Promise<void>;
}

/** 跳转实现：默认是 hash 路由；单测注入假实现，不必在 node 里伪造 window */
export type NavigateTo = (path: string) => void;

/**
 * 安卓实体返回键的正确行为：
 * 在游戏或图鉴里 → 回到游戏馆；已经在游戏馆 → 才退出应用。
 * 不处理的话，孩子在游戏里误按返回键会直接把应用关掉。
 *
 * @param route 当前路由的响应式引用（每次按键都按**最新**路由判断）
 * @param bridge 原生 App 桥；浏览器里 nativeApp() 返回 null → 空操作
 * @param goHome 跳转实现；App.vue 用默认值，单测注入假实现
 */
export function installBackButtonHandler(
  route: Ref<Route>,
  bridge: BackBridge | null = nativeApp(),
  goHome: NavigateTo = navigate,
): void {
  // 浏览器（含 PWA）里没有原生桥：直接返回，不报错
  if (bridge === null) return;
  // App.vue 只在 onMounted 里调一次 → 这个监听只注册一次（防重复注册靠调用方保证）
  bridge.addListener('backButton', () => {
    if (route.value.name !== 'hall') {
      goHome('/');
      return;
    }
    void bridge.exitApp();
  });
}
