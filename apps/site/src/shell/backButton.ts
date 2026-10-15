import { nativeApp } from '@chags/platform';
import { navigate } from '../router';
import type { Route } from '../router';
import type { Ref } from 'vue';

/**
 * 安卓实体返回键的正确行为：
 * 在游戏或图鉴里 → 回到游戏馆；已经在游戏馆 → 才退出应用。
 * 不处理的话，孩子在游戏里误按返回键会直接把应用关掉。
 */
export function installBackButtonHandler(route: Ref<Route>): void {
  const app = nativeApp();
  if (!app) return;
  app.addListener('backButton', () => {
    if (route.value.name !== 'hall') {
      navigate('/');
      return;
    }
    void app.exitApp();
  });
}
