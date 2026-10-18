import { ref } from 'vue';
import type { Ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { Route } from '../router';
import type { BackBridge } from './backButton';

/**
 * router.ts 在模块加载时就执行 `ref(parse(window.location.hash))`（浏览器环境）：
 * 这里先给一个最小 window 桩，再动态 import。backButton 会静态 import router，
 * 所以桩必须赶在 import 之前 —— 顺序不能反。
 */
vi.stubGlobal('window', {
  location: { hash: '' },
  addEventListener: () => {},
});

const { installBackButtonHandler } = await import('./backButton');

function routeOf(name: Route['name'], entryId?: string): Ref<Route> {
  return ref<Route>(entryId === undefined ? { name } : { name, entryId });
}

/** 假原生桥：记下监听回调，press() 就是"按一次安卓实体返回键" */
function fakeBridge() {
  let listener: (() => void) | null = null;
  const addListener = vi.fn((_event: 'backButton', callback: () => void) => {
    listener = callback;
  });
  const exitApp = vi.fn(async () => {});
  const bridge: BackBridge = { addListener, exitApp };
  return {
    bridge,
    addListener,
    exitApp,
    press: (): void => {
      if (listener === null) throw new Error('返回键监听还没注册');
      listener();
    },
  };
}

describe('安卓实体返回键', () => {
  it('不在游戏馆（游戏 / 图鉴 / 复习）：回游戏馆，绝不退出应用', () => {
    for (const name of ['play', 'album', 'review'] as const) {
      const goHome = vi.fn();
      const { bridge, press, exitApp } = fakeBridge();
      installBackButtonHandler(routeOf(name, 'pangu'), bridge, goHome);
      press();
      expect(goHome, name).toHaveBeenCalledWith('/');
      expect(goHome, name).toHaveBeenCalledTimes(1);
      expect(exitApp, name).not.toHaveBeenCalled();
    }
  });

  it('已经在游戏馆：才退出应用', () => {
    const goHome = vi.fn();
    const { bridge, press, exitApp } = fakeBridge();
    installBackButtonHandler(routeOf('hall'), bridge, goHome);
    press();
    expect(goHome).not.toHaveBeenCalled();
    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it('监听只注册一次，且只监听 backButton（App.vue 只在 onMounted 调一次）', () => {
    const { bridge, addListener } = fakeBridge();
    installBackButtonHandler(routeOf('hall'), bridge, vi.fn());
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(addListener.mock.calls[0]![0]).toBe('backButton');
  });

  it('同一个监听按最新路由判断：被带回大厅后再按，就退出', () => {
    const goHome = vi.fn();
    const { bridge, press, exitApp } = fakeBridge();
    const route = routeOf('play', 'pangu');
    installBackButtonHandler(route, bridge, goHome);
    press();
    expect(goHome).toHaveBeenCalledTimes(1);
    // 路由变了（上一次返回已经把我们带回大厅）：再按就该退出
    route.value = { name: 'hall' };
    press();
    expect(goHome).toHaveBeenCalledTimes(1);
    expect(exitApp).toHaveBeenCalledTimes(1);
  });

  it('浏览器里没有原生桥：不报错、不跳转、不退出', () => {
    const goHome = vi.fn();
    expect(() => installBackButtonHandler(routeOf('hall'), null, goHome)).not.toThrow();
    expect(goHome).not.toHaveBeenCalled();
  });
});
